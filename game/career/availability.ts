/**
 * Injuries and suspensions across a league season. Pure and deterministic:
 * availability is a function of the played results (which are themselves a pure
 * function of the seed), so it is fully reconstructed by the save/load replay —
 * nothing extra has to be persisted.
 *
 * Faithful to the classic PC Fútbol rules:
 *  - 5 accumulated yellows  => 1 match suspended.
 *  - Two yellows in a match (expulsion) => 1 match suspended; those two yellows
 *    do NOT also count towards the 5-yellow tally.
 *  - Direct red => 1 or 2 matches suspended (deterministic per player+matchday).
 *  - Injury => out for N matchdays (the engine decides N, 1..8).
 */
import { createRng, hashSeed, type MatchEvent, type MatchResult } from '@engine';

/** How many yellows sum up to one match of suspension. */
export const YELLOWS_PER_BAN = 5;

/** Per-player availability tracked across the season (keyed by player id). */
export interface PlayerAvailability {
  /** Absolute matchday (inclusive) the player is out injured; unset if fit. */
  injuredUntil?: number;
  /** Matchdays of suspension still to serve (counts down each matchday). */
  suspendedMatches?: number;
  /** Running tally of yellow cards this season. */
  yellowAccum: number;
}

/** Season-wide availability map: player id -> availability. */
export type AvailabilityMap = Record<string, PlayerAvailability>;

/** Is the player free to play on `matchday`? (no availability entry => yes). */
export function isAvailable(a: PlayerAvailability | undefined, matchday: number): boolean {
  if (!a) return true;
  if (a.injuredUntil !== undefined && matchday <= a.injuredUntil) return false;
  if (a.suspendedMatches !== undefined && a.suspendedMatches > 0) return false;
  return true;
}

/** True when the player is currently sidelined by injury on `matchday`. */
export function isInjured(a: PlayerAvailability | undefined, matchday: number): boolean {
  return a?.injuredUntil !== undefined && matchday <= a.injuredUntil;
}

/** True when the player is currently serving a suspension. */
export function isSuspended(a: PlayerAvailability | undefined): boolean {
  return (a?.suspendedMatches ?? 0) > 0;
}

/** A player's availability status for a matchday, ready for the UI to render. */
export interface AvailabilityStatus {
  status: 'fit' | 'injured' | 'suspended';
  /** Matchdays still to be missed (0 when fit). */
  matchesOut: number;
}

/** Resolve the display status of a player for `matchday` (injury wins over ban). */
export function availabilityStatus(
  a: PlayerAvailability | undefined,
  matchday: number,
): AvailabilityStatus {
  if (a?.injuredUntil !== undefined && matchday <= a.injuredUntil) {
    return { status: 'injured', matchesOut: a.injuredUntil - matchday + 1 };
  }
  if ((a?.suspendedMatches ?? 0) > 0) {
    return { status: 'suspended', matchesOut: a?.suspendedMatches ?? 0 };
  }
  return { status: 'fit', matchesOut: 0 };
}

/**
 * The club MÉDICO's effect on injuries: a recovery multiplier applied to the injury
 * length of the players it covers (the human squad). Deterministic, no RNG.
 */
export interface MedicalStaff {
  /** Player ids the médico looks after (your squad); others heal at the normal rate. */
  playerIds: ReadonlySet<string>;
  /** Injury-length multiplier in (0,1]: <1 shortens the layoff. See staff.ts. */
  factor: number;
}

/**
 * The (possibly shortened) matchdays a player misses from an injury of `matchesOut`
 * matches, given the médico multiplier. A better médico gets the player back sooner,
 * but never in under one matchday. Deterministic and pure.
 */
export function recoveredMatchesOut(matchesOut: number, factor: number): number {
  return Math.max(1, Math.round(matchesOut * factor));
}

/** Deterministic direct-red ban length (1 or 2 matches) for a player+matchday. */
function redBanLength(result: MatchResult, matchday: number, playerId: string): number {
  const rng = createRng(hashSeed(result.homeId, result.awayId, matchday, playerId, 'redban'));
  return rng.int(2) + 1;
}

/** Group a match's disciplinary/injury events by player id. */
function eventsByPlayer(events: readonly MatchEvent[]): Map<string, MatchEvent[]> {
  const map = new Map<string, MatchEvent[]>();
  for (const e of events) {
    if (e.type === 'goal' || e.type === 'chance') continue;
    const list = map.get(e.playerId);
    if (list) list.push(e);
    else map.set(e.playerId, [e]);
  }
  return map;
}

/**
 * Advance the availability map by one played matchday. Returns a NEW map:
 *  1. every suspended player serves one match (countdown -1);
 *  2. this matchday's cards/injuries are then applied (they take effect from the
 *     NEXT matchday, so the order matters).
 */
export function applyMatchdayAvailability(
  current: AvailabilityMap,
  results: readonly MatchResult[],
  matchday: number,
  medical?: MedicalStaff,
): AvailabilityMap {
  const next: AvailabilityMap = {};
  // 1. Serve suspensions: everyone who sat out this matchday ticks down by one.
  for (const [id, a] of Object.entries(current)) {
    const served = a.suspendedMatches && a.suspendedMatches > 0 ? a.suspendedMatches - 1 : 0;
    next[id] = { ...a, suspendedMatches: served > 0 ? served : undefined };
  }

  const get = (id: string): PlayerAvailability => next[id] ?? (next[id] = { yellowAccum: 0 });

  // 2. Apply the cards and injuries produced this matchday.
  for (const result of results) {
    for (const [playerId, evs] of eventsByPlayer(result.events)) {
      const a = get(playerId);
      const hasRed = evs.some((e) => e.type === 'red');
      const hasSecondYellow = evs.some((e) => e.type === 'secondYellow');

      // Injuries are independent of any card the same player may have seen. A club
      // médico shortens the layoff for the players it covers (your squad).
      const injury = evs.find((e) => e.type === 'injury');
      if (injury?.matchesOut) {
        const out =
          medical && medical.playerIds.has(playerId)
            ? recoveredMatchesOut(injury.matchesOut, medical.factor)
            : injury.matchesOut;
        a.injuredUntil = Math.max(a.injuredUntil ?? 0, matchday + out);
      }

      if (hasRed) {
        a.suspendedMatches = (a.suspendedMatches ?? 0) + redBanLength(result, matchday, playerId);
      } else if (hasSecondYellow) {
        // Expulsion by two yellows: one match, and those yellows are consumed.
        a.suspendedMatches = (a.suspendedMatches ?? 0) + 1;
      } else {
        // Plain yellows accumulate towards the 5-yellow ban.
        const yellows = evs.filter((e) => e.type === 'yellow').length;
        for (let i = 0; i < yellows; i += 1) {
          a.yellowAccum += 1;
          if (a.yellowAccum % YELLOWS_PER_BAN === 0) {
            a.suspendedMatches = (a.suspendedMatches ?? 0) + 1;
          }
        }
      }
    }
  }

  return next;
}
