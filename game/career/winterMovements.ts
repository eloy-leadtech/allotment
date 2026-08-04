/**
 * Winter-market movement primitives — the small, PURE core that lets the winter
 * transfer window coexist with a season that is RE-DERIVED by replay.
 *
 * The problem: a career's in-progress season is derived from `career.teams` and
 * replayed from matchday 1 (see career.ts / save.ts). If we simply mutated the
 * rosters at the winter break, replaying the FIRST half would use the new squads
 * and silently rewrite results already played.
 *
 * The solution recorded here: `career.teams` stays the CURRENT (post-winter)
 * source of truth — exactly as the pre-season market treats it — and every winter
 * transfer is logged as a `WinterMovement` with a single "effect matchday" (the
 * midpoint window). The derivation then REVERSES these movements to reconstruct
 * the pre-winter rosters, replays the already-played first half with them (so
 * those results never change), and RE-APPLIES the movements at the window matchday
 * so the second half uses the new squads. This module owns only the roster
 * bookkeeping; the replay wiring lives in winterMarket.ts.
 *
 * Deliberately dependency-free (no season/career/market imports) so it can be used
 * by both career.ts and winterMarket.ts without an import cycle.
 */

/** One winter transfer: a player moving from one club's roster to another's. */
export interface WinterMovement {
  playerId: string;
  fromClubId: string;
  toClubId: string;
}

/**
 * The winter window's state on a career: the movements made (which drive the
 * derivation) and whether the human has finished the window this season.
 */
export interface WinterMarketState {
  /** Transfers made in the winter window, in the order they were made. */
  movements: WinterMovement[];
  /** True once the human closes the window and returns to play the second half. */
  closed: boolean;
}

/** A fresh, untouched winter window: nothing bought/sold, still to be opened. */
export const DEFAULT_WINTER: WinterMarketState = { movements: [], closed: false };

/**
 * The matchday the winter window opens at: the season's midpoint, so it lands at
 * the break between the two rounds (jornada 20 of 38, 18 of 34, …). Derived from
 * the season length so it stays correct for Primera and Segunda alike.
 */
export function winterWindowMatchday(totalMatchdays: number): number {
  return Math.floor(totalMatchdays / 2) + 1;
}

/** A team-like object we can move a player into or out of (roster carrier). */
interface RosterCarrier<P extends { id: string }> {
  id: string;
  players: P[];
}

/** Move `playerId` from `fromId`'s roster to `toId`'s. Tolerant no-op if absent. */
function movePlayer<P extends { id: string }, T extends RosterCarrier<P>>(
  teams: readonly T[],
  playerId: string,
  fromId: string,
  toId: string,
): T[] {
  const from = teams.find((t) => t.id === fromId);
  const player = from?.players.find((p) => p.id === playerId);
  if (!from || !player) return teams.slice();
  return teams.map((team): T => {
    if (team.id === fromId) return { ...team, players: team.players.filter((p) => p.id !== playerId) };
    if (team.id === toId) return { ...team, players: [...team.players, player] };
    return team;
  });
}

/**
 * Apply the winter movements FORWARD (fromClub → toClub), in the order they were
 * made. Generic over the roster's player type so it serves both the career's
 * full-data teams and the season's competition teams.
 */
export function applyWinterMovements<P extends { id: string }, T extends RosterCarrier<P>>(
  teams: readonly T[],
  movements: readonly WinterMovement[],
): T[] {
  let out: T[] = teams.slice();
  for (const m of movements) out = movePlayer(out, m.playerId, m.fromClubId, m.toClubId);
  return out;
}

/**
 * Undo the winter movements (toClub → fromClub), in REVERSE order, reconstructing
 * the pre-winter rosters from a post-winter squad. The exact inverse of
 * `applyWinterMovements`, so `reverse(apply(x)) === x` for any legal sequence.
 */
export function reverseWinterMovements<P extends { id: string }, T extends RosterCarrier<P>>(
  teams: readonly T[],
  movements: readonly WinterMovement[],
): T[] {
  let out: T[] = teams.slice();
  for (let i = movements.length - 1; i >= 0; i -= 1) {
    const m = movements[i]!;
    out = movePlayer(out, m.playerId, m.toClubId, m.fromClubId);
  }
  return out;
}
