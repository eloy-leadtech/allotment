/**
 * International transfer market (SPEC §3, E10): sign players from clubs in OTHER
 * countries' leagues, reusing the same economy as the domestic market
 * (valuation, asking price, release clause, budget — see market.ts).
 *
 * The game/engine layers are pure and cannot fetch, so the foreign field is
 * INJECTED: the wiring layer assembles a pool of foreign clubs (from catalogue
 * leagues it loads) and passes it in. These functions only price and move
 * players; they never do I/O.
 *
 * A valid signing must respect three limits:
 *  - presupuesto: you cannot spend more than your budget;
 *  - cláusula: paying a player's release clause is an instant buy-out (its ceiling);
 *  - tope de plantilla: your squad cannot exceed {@link MAX_SQUAD} players.
 */
import type { Player } from '@data';
import type { CareerState, CareerTeam } from './types';
import { playerAge, seasonStartYear } from './development';
import { marketValue, askingPrice, releaseClause } from './market';
import { initialContract } from './contracts';
import { seasonFromCareer, careerTeamName } from './career';
import { recordTransferHeadline } from './hemeroteca';

/**
 * The maximum squad size (tope de plantilla). International signings are refused
 * once your squad reaches it, mirroring the classic games' roster cap. Domestic
 * trading does not enforce it yet; see NOTAS (follow-up).
 */
export const MAX_SQUAD = 25;

/** A club from another country's league, offered to the human in the market. */
export interface ForeignClub {
  id: string;
  nombre: string;
  /** Catalogue country code of the club's league (e.g. "ITA"). */
  country: string;
  /** Catalogue league id the club was loaded from. */
  leagueId: string;
  players: Player[];
}

/** A foreign player the human could sign, with their price broken down. */
export interface ForeignListing {
  player: Player;
  clubId: string;
  clubName: string;
  country: string;
  leagueId: string;
  value: number;
  askingPrice: number;
  /** Release clause: pay it and the transfer is automatic. */
  clause: number;
}

/** The human squad's current size (for the tope de plantilla check). */
export function squadSize(career: CareerState): number {
  return career.teams.find((t) => t.id === career.humanTeamId)?.players.length ?? 0;
}

/** The market is only open in the pre-season (before any matchday is played). */
function isMarketOpen(career: CareerState): boolean {
  return career.season.results.length === 0;
}

/**
 * Every foreign player the human could sign, most valuable first. Priced with
 * the same curve as the domestic market, so a cross-border deal costs what the
 * player is worth. Pure and deterministic from the injected pool.
 */
export function internationalListings(
  career: CareerState,
  foreign: readonly ForeignClub[],
): ForeignListing[] {
  const startYear = seasonStartYear(career.temporada);
  const listings: ForeignListing[] = [];
  for (const club of foreign) {
    if (club.id === career.humanTeamId) continue;
    for (const player of club.players) {
      const age = playerAge(player, startYear);
      listings.push({
        player,
        clubId: club.id,
        clubName: club.nombre,
        country: club.country,
        leagueId: club.leagueId,
        value: marketValue(player, age),
        askingPrice: askingPrice(player, age),
        clause: releaseClause(player, age),
      });
    }
  }
  return listings.sort((a, b) => b.value - a.value);
}

/** The outcome of an international signing. */
export type IntlOutcome =
  | { status: 'accepted'; career: CareerState; price: number }
  | { status: 'rejected' }
  | { status: 'no-budget'; price: number }
  | { status: 'squad-full' }
  | { status: 'no-encontrado' };

/** Find a foreign player across the injected pool. */
function findForeign(
  foreign: readonly ForeignClub[],
  playerId: string,
): { club: ForeignClub; player: Player } | null {
  for (const club of foreign) {
    const player = club.players.find((p) => p.id === playerId);
    if (player) return { club, player };
  }
  return null;
}

/** A player id guaranteed not to collide with anyone already in the career world. */
function uniqueIncomingId(career: CareerState, leagueId: string, playerId: string): string {
  const taken = new Set(career.teams.flatMap((t) => t.players.map((p) => p.id)));
  if (!taken.has(playerId)) return playerId;
  let candidate = `${leagueId}:${playerId}`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${leagueId}:${playerId}#${n++}`;
  return candidate;
}

/**
 * Sign a foreign player into the human squad. Without `offer` the deal closes at
 * the asking price; with an `offer`, paying the release clause (or more) is an
 * instant buy-out, an offer at/above the asking price closes at your figure, and
 * anything lower is rejected (no counter-offer across borders yet — see NOTAS).
 *
 * Enforces budget and the tope de plantilla ({@link MAX_SQUAD}). Throws only if
 * the market is closed (season already under way), matching the domestic market.
 */
export function buyInternational(
  career: CareerState,
  playerId: string,
  foreign: readonly ForeignClub[],
  offer?: number,
): IntlOutcome {
  if (!isMarketOpen(career)) {
    throw new Error('El mercado solo está abierto antes de empezar la temporada');
  }
  const found = findForeign(foreign, playerId);
  if (!found) return { status: 'no-encontrado' };
  const { club, player } = found;

  // Tope de plantilla: a full squad cannot take another body.
  if (squadSize(career) >= MAX_SQUAD) return { status: 'squad-full' };

  const age = playerAge(player, seasonStartYear(career.temporada));
  const asking = askingPrice(player, age);
  const clause = releaseClause(player, age);

  let price: number;
  if (offer === undefined) {
    price = asking;
  } else if (offer >= clause) {
    price = clause; // release-clause buy-out
  } else if (offer >= asking) {
    price = offer;
  } else {
    return { status: 'rejected' };
  }

  if (career.budget < price) return { status: 'no-budget', price };

  return { status: 'accepted', career: applyForeignPurchase(career, club, player, price), price };
}

/** Move a foreign player into the human squad, debit the fee, book the deal. */
function applyForeignPurchase(
  career: CareerState,
  club: ForeignClub,
  player: Player,
  price: number,
): CareerState {
  const incomingId = uniqueIncomingId(career, club.leagueId, player.id);
  const signed: Player = incomingId === player.id ? player : { ...player, id: incomingId };

  const teams: CareerTeam[] = career.teams.map((team) =>
    team.id === career.humanTeamId ? { ...team, players: [...team.players, signed] } : team,
  );

  // The signing joins your wage book on a fresh, market-value-based deal.
  const startYear = seasonStartYear(career.temporada);
  const contract = initialContract(signed, playerAge(signed, startYear), career.seed, career.seasonNumber);

  // A cross-border signing makes the hemeroteca the moment it closes.
  const hemeroteca = recordTransferHeadline(career.hemeroteca, {
    kind: 'compra',
    seasonNumber: career.seasonNumber,
    temporada: career.temporada,
    teamName: careerTeamName(career, career.humanTeamId),
    playerName: signed.nombre,
    amount: price,
  });

  const next: CareerState = {
    ...career,
    teams,
    budget: career.budget - price,
    contracts: { ...career.contracts, [signed.id]: contract },
    hemeroteca,
  };
  return { ...next, season: seasonFromCareer(next) };
}
