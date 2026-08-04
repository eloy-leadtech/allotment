/**
 * Transfer-market economy: player valuation and club budgets. Pure and
 * deterministic — values come only from a player's rating, age and position, so
 * the same squad always prices out the same way.
 *
 * Values are whole euros. The curve is deliberately steep: a superstar is worth
 * many times a solid starter, matching how the classic games felt.
 */
import { createRng, hashSeed } from '@engine';
import type { Player, Position } from '@data';
import type { CareerState, CareerTeam } from './types';
import { playerAge, seasonStartYear } from './development';
import { initialContract } from './contracts';
import { seasonFromCareer, careerTeamName } from './career';
import { recordTransferHeadline } from './hemeroteca';

/** Rating above this floor is what you actually pay for; below it is nominal. */
const RATING_FLOOR = 40;
/** Scales the cubic rating curve into euros. */
const VALUE_SCALE = 320;
/** Nobody is worth literally nothing. */
const MIN_VALUE = 50_000;

/** Age multiplier: peak years are dearest, veterans cheap, kids a bit unproven. */
function ageMultiplier(age: number | null): number {
  if (age === null) return 0.8;
  if (age <= 18) return 0.85;
  if (age <= 21) return 1.0;
  if (age <= 27) return 1.15;
  if (age <= 30) return 0.85;
  if (age <= 32) return 0.55;
  if (age <= 34) return 0.35;
  return 0.2;
}

const POSITION_MULTIPLIER: Record<Position, number> = {
  DEL: 1.1,
  MED: 1.0,
  DEF: 0.92,
  POR: 0.85,
};

/** Market value of a player in whole euros, given their age this season. */
export function marketValue(player: Player, age: number | null): number {
  const over = Math.max(0, player.media - RATING_FLOOR);
  const base = over * over * over; // cubic: superstars cost exponentially more
  const value = base * ageMultiplier(age) * POSITION_MULTIPLIER[player.posicion] * VALUE_SCALE;
  return Math.max(MIN_VALUE, Math.round(value));
}

/** Total market value of a squad for the given season start year. */
export function squadValue(team: CareerTeam, seasonStartYear: number): number {
  return team.players.reduce((sum, p) => sum + marketValue(p, playerAge(p, seasonStartYear)), 0);
}

/** Fraction of squad value a club can spend on transfers. */
const BUDGET_FRACTION = 0.12;

/**
 * A club's starting transfer budget: a fraction of its squad value, so richer
 * squads get more to spend. Deterministic from the roster.
 */
export function initialBudget(team: CareerTeam, seasonStartYear: number): number {
  return Math.round(squadValue(team, seasonStartYear) * BUDGET_FRACTION);
}

/** Human-friendly euro amount, e.g. 40_500_000 -> "40,5 M€", 850_000 -> "850 k€". */
export function formatEuros(euros: number): string {
  if (euros >= 1_000_000) {
    const millions = euros / 1_000_000;
    const text = millions >= 100 ? String(Math.round(millions)) : millions.toFixed(1).replace('.', ',');
    return `${text} M€`;
  }
  if (euros >= 1_000) {
    return `${Math.round(euros / 1_000)} k€`;
  }
  return `${euros} €`;
}

// --- Compraventa (fase de mercado, solo antes de empezar la temporada) --------

/** Premium a selling club adds on top of pure market value. */
const ASKING_PREMIUM = 1.3;
/** Release clause: pay it and the sale is automatic, no negotiation. */
const CLAUSE_MULTIPLIER = 2.5;
/** Below this fraction of the asking price, an offer is dismissed outright. */
const OFFER_FLOOR_FRACTION = 0.85;

/** What an AI club asks to sell one of its players. */
export function askingPrice(player: Player, age: number | null): number {
  return Math.round(marketValue(player, age) * ASKING_PREMIUM);
}

/** A player's release clause: pay it and the transfer goes through instantly. */
export function releaseClause(player: Player, age: number | null): number {
  return Math.round(marketValue(player, age) * CLAUSE_MULTIPLIER);
}

/** A buyable player offered by an AI club. */
export interface TransferListing {
  player: Player;
  clubId: string;
  value: number;
  askingPrice: number;
  /** Release clause: pay it and the transfer is automatic. */
  clause: number;
}

/** An AI club's offer for one of your players. */
export interface Bid {
  playerId: string;
  fromClubId: string;
  amount: number;
}

export interface TransferResult {
  career: CareerState;
  ok: boolean;
  reason?: 'no-encontrado' | 'presupuesto';
}

/** The market is only open in the pre-season (before any matchday is played). */
function assertMarketOpen(career: CareerState): void {
  if (career.season.results.length > 0) {
    throw new Error('El mercado solo está abierto antes de empezar la temporada');
  }
}

/** Re-derive the in-progress season after the rosters change. */
function withDerivedSeason(career: CareerState): CareerState {
  return { ...career, season: seasonFromCareer(career) };
}

/** Every player you could buy from the AI clubs, most valuable first. */
export function buyableListings(career: CareerState): TransferListing[] {
  const startYear = seasonStartYear(career.temporada);
  const listings: TransferListing[] = [];
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    for (const player of team.players) {
      const age = playerAge(player, startYear);
      listings.push({
        player,
        clubId: team.id,
        value: marketValue(player, age),
        askingPrice: askingPrice(player, age),
        clause: releaseClause(player, age),
      });
    }
  }
  return listings.sort((a, b) => b.value - a.value);
}

/**
 * Buy an AI club's player at their asking price. Soft-fails (ok:false) if the
 * player is not on the market or you cannot afford them; throws only if the
 * market is closed (season already under way).
 */
export function buyPlayer(career: CareerState, playerId: string): TransferResult {
  assertMarketOpen(career);
  const startYear = seasonStartYear(career.temporada);
  let owner: CareerTeam | undefined;
  let player: Player | undefined;
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    const found = team.players.find((p) => p.id === playerId);
    if (found) {
      owner = team;
      player = found;
      break;
    }
  }
  if (!owner || !player) return { career, ok: false, reason: 'no-encontrado' };

  const price = askingPrice(player, playerAge(player, startYear));
  if (career.budget < price) return { career, ok: false, reason: 'presupuesto' };

  return { career: applyPurchase(career, owner.id, player, price), ok: true };
}

/** Move `player` from `ownerId` to the human squad and debit `price`. */
function applyPurchase(career: CareerState, ownerId: string, player: Player, price: number): CareerState {
  const teams = career.teams.map((team) => {
    if (team.id === ownerId) return { ...team, players: team.players.filter((p) => p.id !== player.id) };
    if (team.id === career.humanTeamId) return { ...team, players: [...team.players, player] };
    return team;
  });
  // A new signing joins your wage book on a fresh, market-value-based deal.
  const startYear = seasonStartYear(career.temporada);
  const contract = initialContract(player, playerAge(player, startYear), career.seed, career.seasonNumber);
  // A club-record purchase makes the hemeroteca the moment it closes.
  const hemeroteca = recordTransferHeadline(career.hemeroteca, {
    kind: 'compra',
    seasonNumber: career.seasonNumber,
    temporada: career.temporada,
    teamName: careerTeamName(career, career.humanTeamId),
    playerName: player.nombre,
    amount: price,
  });
  return withDerivedSeason({
    ...career,
    teams,
    budget: career.budget - price,
    contracts: { ...career.contracts, [player.id]: contract },
    hemeroteca,
  });
}

/** The outcome of making an offer for an AI club's player. */
export type NegotiationOutcome =
  | { status: 'accepted'; career: CareerState; price: number }
  | { status: 'countered'; counter: number }
  | { status: 'rejected' }
  | { status: 'no-budget'; price: number }
  | { status: 'no-encontrado' };

/**
 * Negotiate a signing by making an OFFER (instead of paying the fixed asking
 * price). The selling club's answer is deterministic:
 * - offer ≥ the release clause → sold at the clause (an instant buy-out);
 * - offer ≥ the asking price → sold at your offer;
 * - offer ≥ 85% of the asking price → the club counters at the midpoint;
 * - below that → the offer is rejected outright.
 * Acceptance still requires budget. Throws only if the market is closed.
 */
export function negotiateBuy(career: CareerState, playerId: string, offer: number): NegotiationOutcome {
  assertMarketOpen(career);
  const startYear = seasonStartYear(career.temporada);
  let owner: CareerTeam | undefined;
  let player: Player | undefined;
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    const found = team.players.find((p) => p.id === playerId);
    if (found) {
      owner = team;
      player = found;
      break;
    }
  }
  if (!owner || !player) return { status: 'no-encontrado' };

  const age = playerAge(player, startYear);
  const asking = askingPrice(player, age);
  const clause = releaseClause(player, age);

  let price: number | null = null;
  if (offer >= clause) price = clause;
  else if (offer >= asking) price = offer;
  else if (offer >= Math.round(asking * OFFER_FLOOR_FRACTION)) {
    return { status: 'countered', counter: Math.round((offer + asking) / 2) };
  } else {
    return { status: 'rejected' };
  }

  if (career.budget < price) return { status: 'no-budget', price };
  return { status: 'accepted', career: applyPurchase(career, owner.id, player, price), price };
}

/**
 * Close a signing at a price the selling club COUNTERED with. Validates the
 * price is a genuine counter (between the offer floor and the asking price) and
 * that you can afford it, then completes the transfer. Soft-fails otherwise.
 */
export function acceptCounter(career: CareerState, playerId: string, counter: number): TransferResult {
  assertMarketOpen(career);
  const startYear = seasonStartYear(career.temporada);
  let owner: CareerTeam | undefined;
  let player: Player | undefined;
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    const found = team.players.find((p) => p.id === playerId);
    if (found) {
      owner = team;
      player = found;
      break;
    }
  }
  if (!owner || !player) return { career, ok: false, reason: 'no-encontrado' };

  const asking = askingPrice(player, playerAge(player, startYear));
  const floor = Math.round(asking * OFFER_FLOOR_FRACTION);
  if (counter < floor || counter > asking) return { career, ok: false, reason: 'no-encontrado' };
  if (career.budget < counter) return { career, ok: false, reason: 'presupuesto' };
  return { career: applyPurchase(career, owner.id, player, counter), ok: true };
}

/**
 * Sell one of your players to `toClubId` for `amount`. Soft-fails if the player
 * is not in your squad or the destination is invalid.
 */
export function sellPlayer(
  career: CareerState,
  playerId: string,
  toClubId: string,
  amount: number,
): TransferResult {
  assertMarketOpen(career);
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const player = human?.players.find((p) => p.id === playerId);
  const buyer = career.teams.find((t) => t.id === toClubId);
  if (!player || !buyer || toClubId === career.humanTeamId) {
    return { career, ok: false, reason: 'no-encontrado' };
  }
  const sold = player;
  const teams = career.teams.map((team) => {
    if (team.id === career.humanTeamId) return { ...team, players: team.players.filter((p) => p.id !== playerId) };
    if (team.id === toClubId) return { ...team, players: [...team.players, sold] };
    return team;
  });
  // The sold player leaves your wage book with them.
  const contracts = { ...career.contracts };
  delete contracts[playerId];
  // A club-record sale makes the hemeroteca the moment it closes.
  const hemeroteca = recordTransferHeadline(career.hemeroteca, {
    kind: 'venta',
    seasonNumber: career.seasonNumber,
    temporada: career.temporada,
    teamName: careerTeamName(career, career.humanTeamId),
    playerName: sold.nombre,
    amount,
  });
  return {
    career: withDerivedSeason({ ...career, teams, budget: career.budget + amount, contracts, hemeroteca }),
    ok: true,
  };
}

/** Accept an AI bid: sell the player to the bidding club for the offered amount. */
export function acceptBid(career: CareerState, bid: Bid): TransferResult {
  return sellPlayer(career, bid.playerId, bid.fromClubId, bid.amount);
}

/** How likely a player of a given rating is to attract a bid this window. */
function bidProbability(media: number): number {
  if (media >= 82) return 0.6;
  if (media >= 75) return 0.35;
  if (media >= 68) return 0.15;
  return 0.03;
}

/**
 * The AI clubs' offers for your players this window. Deterministic from the
 * career seed and season number; better players attract more (and higher) bids.
 * Players are visited in id order so the RNG stream is stable.
 */
export function generateBids(career: CareerState): Bid[] {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const others = career.teams.filter((t) => t.id !== career.humanTeamId);
  if (!human || others.length === 0) return [];

  const rng = createRng(hashSeed(career.seed, 'bids', career.seasonNumber));
  const startYear = seasonStartYear(career.temporada);
  const bids: Bid[] = [];
  const players = [...human.players].sort((a, b) => a.id.localeCompare(b.id));
  for (const player of players) {
    const roll = rng.next01();
    const idxRoll = rng.int(others.length);
    const amountRoll = rng.next01();
    if (roll > bidProbability(player.media)) continue;
    const club = others[idxRoll];
    if (!club) continue;
    const value = marketValue(player, playerAge(player, startYear));
    bids.push({
      playerId: player.id,
      fromClubId: club.id,
      amount: Math.round(value * (0.8 + amountRoll * 0.6)),
    });
  }
  return bids;
}
