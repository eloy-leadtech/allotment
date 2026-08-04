/**
 * MERCADO DE FICHAJES DE INVIERNO — the mid-season (January) transfer window.
 *
 * Faithful to the classic PC Fútbol, the league pauses at its midpoint (jornada 20
 * of 38) for a WINTER WINDOW: you may buy and sell with your current budget, AI
 * clubs bid for your players, and you can negotiate a fee just like in the
 * pre-season. The transfers you close only reinforce (or weaken) your squad for the
 * SECOND half — nothing already played changes.
 *
 * ── Why this is not just "the pre-season market, later" ──────────────────────────
 * A career's in-progress season is DERIVED from `career.teams` and replayed from
 * matchday 1 (see career.ts / save.ts). Mutating the rosters mid-season and
 * re-deriving would replay the FIRST half with the new squads and rewrite results
 * already played. So the pre-season market (market.ts) is hard-closed once a
 * matchday is on the board.
 *
 * ── How the winter window avoids desyncing the season ────────────────────────────
 * `career.teams` (and `budget`, `contracts`) stay the CURRENT, post-winter source
 * of truth — exactly as the pre-season market leaves them, so every other mechanic
 * (transición, contratos, cesiones, cantera, masa salarial) keeps reading the live
 * squad unchanged. Each transfer is additionally logged as a `WinterMovement` with
 * a single EFFECT MATCHDAY: the window matchday. The derivation then
 *   1. REVERSES the movements on `career.teams` to rebuild the pre-winter rosters,
 *   2. replays jornadas 1..(window-1) with them — so the first half is byte-identical,
 *   3. RE-APPLIES the movements at the window matchday so jornadas window..end use
 *      the new squads.
 * `seasonFromCareer` does step 1 (builds the pre-winter fresh season);
 * `replaySeasonCareer` here does steps 2-3. Every live winter transaction simply
 * updates the career and RE-DERIVES its season through that same replay, so the
 * live season and a save→load round-trip are identical by construction — one code
 * path, no incremental drift. Deterministic throughout (seeded PRNG per season).
 */
import { createRng, hashSeed } from '@engine';
import type { Player } from '@data';
import { advanceMatchday, isSeasonOver, type SeasonState } from '../season/season';
import { seasonFromCareer, tacticsForSquad } from './career';
import { playerAge, seasonStartYear } from './development';
import { initialContract } from './contracts';
import { bumpSeasonMorale, moraleDeltaAt } from './pressConference';
import {
  askingPrice,
  buyableListings,
  bidProbability,
  marketValue,
  releaseClause,
  type Bid,
  type NegotiationOutcome,
  type TransferListing,
  type TransferResult,
} from './market';
import type { CareerState, CareerTactics, CareerTeam, PressAnswer } from './types';
import {
  applyWinterMovements,
  DEFAULT_WINTER,
  winterWindowMatchday,
  type WinterMarketState,
  type WinterMovement,
} from './winterMovements';

/**
 * Below this fraction of the asking price a winter offer is countered; further
 * below, rejected. Mirrors the pre-season market's negotiation band so buying in
 * January feels the same as buying in August.
 */
const WINTER_OFFER_FLOOR_FRACTION = 0.85;

/** Whether the winter window is open for transactions right now. */
export function isWinterWindowOpen(career: CareerState): boolean {
  const winter = career.winter ?? DEFAULT_WINTER;
  if (winter.closed) return false;
  const season = career.season;
  if (isSeasonOver(season)) return false;
  return season.currentMatchday === winterWindowMatchday(season.totalMatchdays);
}

/** Guard the transactional entry points: throw if the window is not open. */
function assertWinterOpen(career: CareerState): void {
  if (!isWinterWindowOpen(career)) {
    throw new Error('El mercado de invierno solo está abierto en la ventana de mitad de temporada');
  }
}

/**
 * Apply the winter movements to a live SeasonState (its competition teams), moving
 * each MatchPlayer between clubs and re-resolving the human's chosen XI against the
 * new roster (a sold starter drops out to the auto-XI; a signing simply isn't
 * picked until you choose it). Used inside `replaySeasonCareer` at the window
 * matchday, so it never touches already-played results.
 */
export function applyWinterToSeason(
  season: SeasonState,
  movements: readonly WinterMovement[],
  humanTactics: CareerTactics | undefined,
  humanTeamId: string,
): SeasonState {
  const moved = applyWinterMovements(season.teams, movements);
  const teams = moved.map((team) =>
    team.id === humanTeamId ? { ...team, tactics: tacticsForSquad(humanTactics, team.players) } : team,
  );
  return { ...season, teams };
}

/**
 * Replay a fresh (pre-winter) season up to `targetMatchday`, interleaving BOTH the
 * press-conference morale bumps (at each answer's matchday) AND the winter roster
 * swap (once, at the window matchday, before that matchday is played). Supersedes
 * `replaySeasonWithPress`: with no winter movements it is identical to it, and with
 * no answers either it is a plain matchday replay. The winter swap is applied
 * BEFORE the window matchday's press bump, matching the live flow (you shop in the
 * window, then face the press for that jornada), so a signing also receives that
 * matchday's morale bump in both the live and reloaded careers.
 */
export function replaySeasonCareer(
  fresh: SeasonState,
  targetMatchday: number,
  humanTeamId: string,
  humanTactics: CareerTactics | undefined,
  answers: readonly PressAnswer[],
  winter: WinterMarketState | undefined,
): SeasonState {
  const movements = winter?.movements ?? [];
  const winterMd = winterWindowMatchday(fresh.totalMatchdays);
  const applyWinterIfDue = (s: SeasonState): SeasonState =>
    movements.length > 0 && s.currentMatchday === winterMd
      ? applyWinterToSeason(s, movements, humanTactics, humanTeamId)
      : s;
  let s = fresh;
  while (s.currentMatchday < targetMatchday && !isSeasonOver(s)) {
    s = applyWinterIfDue(s);
    s = bumpSeasonMorale(s, humanTeamId, moraleDeltaAt(answers, s.currentMatchday));
    s = advanceMatchday(s).state;
  }
  // Resume point (targetMatchday not yet played): apply the pending winter swap /
  // press bump so the loaded squad about to play it matches the live one.
  s = applyWinterIfDue(s);
  return bumpSeasonMorale(s, humanTeamId, moraleDeltaAt(answers, s.currentMatchday));
}

/**
 * Re-derive the career's in-progress season after a winter transaction: rebuild the
 * pre-winter fresh season and replay it to the current resume matchday through
 * `replaySeasonCareer`. This is the SAME path a save→load takes, so the live season
 * can never drift from a reloaded one.
 */
function withWinterDerivedSeason(career: CareerState): CareerState {
  const season = replaySeasonCareer(
    seasonFromCareer(career),
    career.season.currentMatchday,
    career.humanTeamId,
    career.tactics,
    career.press?.answers ?? [],
    career.winter,
  );
  return { ...career, season };
}

/** Append a movement to the career's winter log. */
function recordMovement(career: CareerState, movement: WinterMovement): WinterMarketState {
  const winter = career.winter ?? DEFAULT_WINTER;
  return { ...winter, movements: [...winter.movements, movement] };
}

/** Move `player` from `ownerId` to the human squad, debit `price`, log the winter move. */
function applyWinterPurchase(
  career: CareerState,
  ownerId: string,
  player: Player,
  price: number,
): CareerState {
  const movement: WinterMovement = { playerId: player.id, fromClubId: ownerId, toClubId: career.humanTeamId };
  const teams = applyWinterMovements(career.teams, [movement]);
  const startYear = seasonStartYear(career.temporada);
  // A January signing joins your wage book on a fresh, market-value-based deal.
  const contract = initialContract(player, playerAge(player, startYear), career.seed, career.seasonNumber);
  return withWinterDerivedSeason({
    ...career,
    teams,
    budget: career.budget - price,
    contracts: { ...career.contracts, [player.id]: contract },
    winter: recordMovement(career, movement),
  });
}

/** Locate an AI-owned player across the current rosters (skips the human club). */
function findAiPlayer(career: CareerState, playerId: string): { owner: CareerTeam; player: Player } | null {
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    const found = team.players.find((p) => p.id === playerId);
    if (found) return { owner: team, player: found };
  }
  return null;
}

/** Every player you could buy from the AI clubs this winter, most valuable first. */
export function winterBuyableListings(career: CareerState): TransferListing[] {
  return buyableListings(career);
}

/**
 * Buy an AI club's player at their asking price during the winter window. Soft-fails
 * (ok:false) if the player is not on the market or you cannot afford them; throws
 * only if the winter window is not open.
 */
export function winterBuyPlayer(career: CareerState, playerId: string): TransferResult {
  assertWinterOpen(career);
  const hit = findAiPlayer(career, playerId);
  if (!hit) return { career, ok: false, reason: 'no-encontrado' };
  const price = askingPrice(hit.player, playerAge(hit.player, seasonStartYear(career.temporada)));
  if (career.budget < price) return { career, ok: false, reason: 'presupuesto' };
  return { career: applyWinterPurchase(career, hit.owner.id, hit.player, price), ok: true };
}

/**
 * Negotiate a winter signing by making an OFFER instead of paying the fixed asking
 * price. Same deterministic answer as the pre-season market: at/above the clause is
 * an instant buy-out, at/above the asking price sells at your offer, within 85% of
 * it the club counters at the midpoint, below that it is rejected.
 */
export function winterNegotiateBuy(career: CareerState, playerId: string, offer: number): NegotiationOutcome {
  assertWinterOpen(career);
  const hit = findAiPlayer(career, playerId);
  if (!hit) return { status: 'no-encontrado' };

  const age = playerAge(hit.player, seasonStartYear(career.temporada));
  const asking = askingPrice(hit.player, age);
  const clause = releaseClause(hit.player, age);

  let price: number | null = null;
  if (offer >= clause) price = clause;
  else if (offer >= asking) price = offer;
  else if (offer >= Math.round(asking * WINTER_OFFER_FLOOR_FRACTION)) {
    return { status: 'countered', counter: Math.round((offer + asking) / 2) };
  } else {
    return { status: 'rejected' };
  }

  if (career.budget < price) return { status: 'no-budget', price };
  return { status: 'accepted', career: applyWinterPurchase(career, hit.owner.id, hit.player, price), price };
}

/** Close a winter signing at a price the selling club COUNTERED with. */
export function winterAcceptCounter(career: CareerState, playerId: string, counter: number): TransferResult {
  assertWinterOpen(career);
  const hit = findAiPlayer(career, playerId);
  if (!hit) return { career, ok: false, reason: 'no-encontrado' };
  const asking = askingPrice(hit.player, playerAge(hit.player, seasonStartYear(career.temporada)));
  const floor = Math.round(asking * WINTER_OFFER_FLOOR_FRACTION);
  if (counter < floor || counter > asking) return { career, ok: false, reason: 'no-encontrado' };
  if (career.budget < counter) return { career, ok: false, reason: 'presupuesto' };
  return { career: applyWinterPurchase(career, hit.owner.id, hit.player, counter), ok: true };
}

/** Sell one of your players to `toClubId` for `amount` during the winter window. */
export function winterSellPlayer(
  career: CareerState,
  playerId: string,
  toClubId: string,
  amount: number,
): TransferResult {
  assertWinterOpen(career);
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const player = human?.players.find((p) => p.id === playerId);
  const buyer = career.teams.find((t) => t.id === toClubId);
  if (!player || !buyer || toClubId === career.humanTeamId) {
    return { career, ok: false, reason: 'no-encontrado' };
  }
  const movement: WinterMovement = { playerId, fromClubId: career.humanTeamId, toClubId };
  const teams = applyWinterMovements(career.teams, [movement]);
  // The sold player leaves your wage book with them.
  const contracts = { ...career.contracts };
  delete contracts[playerId];
  return {
    career: withWinterDerivedSeason({
      ...career,
      teams,
      budget: career.budget + amount,
      contracts,
      winter: recordMovement(career, movement),
    }),
    ok: true,
  };
}

/**
 * The AI clubs' winter offers for your players. Deterministic from the career seed
 * and season number (a distinct stream from the pre-season bids), so the same
 * career always sees the same January interest.
 */
export function generateWinterBids(career: CareerState): Bid[] {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const others = career.teams.filter((t) => t.id !== career.humanTeamId);
  if (!human || others.length === 0) return [];

  const rng = createRng(hashSeed(career.seed, 'winter-bids', career.seasonNumber));
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

/** Accept an AI winter bid: sell the player to the bidding club for the offered amount. */
export function winterAcceptBid(career: CareerState, bid: Bid): TransferResult {
  return winterSellPlayer(career, bid.playerId, bid.fromClubId, bid.amount);
}

/**
 * Close the winter window: the human is done shopping and returns to play the
 * second half. Recorded on the career so the window does not re-open on reload;
 * the season transition resets it for next year.
 */
export function closeWinterWindow(career: CareerState): CareerState {
  const winter = career.winter ?? DEFAULT_WINTER;
  if (winter.closed) return career;
  return { ...career, winter: { ...winter, closed: true } };
}
