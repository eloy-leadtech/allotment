/**
 * Fatigue / physical condition (fatiga / estado físico) — the PC Fútbol
 * wear-and-rotation mechanic.
 *
 * A score in [0, 100] where 0 is FRESH (neutral, no effect on the pitch) and 100
 * is spent. Playing a matchday adds fatigue; a matchday of rest sheds a fraction
 * of it (exponential decay toward fresh, mirroring how FORM regresses toward
 * neutral). Fatigue only ever HURTS: it feeds a SMALL multiplier (always <= 1)
 * into a player's effective ratings, so a fresh squad behaves exactly as before
 * and a jaded one dips a touch. Because both teams tire symmetrically the
 * scoreline is barely moved (the ~2.6 goals/game balance holds), yet the
 * individual incentive to ROTATE is real: leaning on the same eleven every week
 * wears them down while the bench recovers.
 *
 * Pure, framework-free and deterministic (no RNG): replaying a season from its
 * fresh start always reconstructs identical fatigue — nothing is persisted.
 */
import type { MatchPlayer } from './types';

/** A fresh player carries no fatigue (neutral: no effect on ratings). */
export const FRESH_FATIGUE = 0;
export const FATIGUE_MIN = 0;
export const FATIGUE_MAX = 100;

/** Max fraction fatigue removes from a rating at the extreme (100 => -5%). */
const FATIGUE_WEIGHT = 0.05;

/** Fatigue accumulated by playing a full matchday. */
const MATCH_FATIGUE = 18;
/** Fraction of the current fatigue shed each matchday (decay toward fresh). */
const REST_RECOVERY_RATE = 0.25;
/** Flat fatigue also shed each matchday, so recovery always reaches 0 (no rounding floor). */
const REST_RECOVERY_FLAT = 3;

/** Clamp to the fatigue range and round to an integer. */
export function clampFatigue(value: number): number {
  return Math.max(FATIGUE_MIN, Math.min(FATIGUE_MAX, Math.round(value)));
}

/** A player's fatigue, defaulting to fresh when unset. */
export function playerFatigue(p: Pick<MatchPlayer, 'fatigue'>): number {
  return p.fatigue ?? FRESH_FATIGUE;
}

/**
 * The performance multiplier a player's fatigue applies to their effective
 * ratings. Exactly 1 when fresh (fatigue 0, so a squad with no fatigue data
 * behaves identically to before), sliding down to ~0.95 when fully spent. Never
 * above 1 — fatigue only tires, it never boosts.
 */
export function fatigueMultiplier(fatigue: number = FRESH_FATIGUE): number {
  const f = clampFatigue(fatigue) / FATIGUE_MAX; // [0, 1]
  return 1 - f * FATIGUE_WEIGHT;
}

/**
 * Evolve a player's fatigue by one matchday. Everyone recovers a little each week
 * (proportional decay plus a flat amount so recovery always reaches fresh); those
 * who played then add the match cost on top. A permanent starter therefore
 * plateaus at a moderate, still-playable fatigue while the bench drains to fresh.
 */
export function nextFatigue(fatigue: number, played: boolean): number {
  const recovered = Math.max(0, fatigue - fatigue * REST_RECOVERY_RATE - REST_RECOVERY_FLAT);
  if (!played) return clampFatigue(recovered);
  return clampFatigue(recovered + MATCH_FATIGUE);
}

/**
 * Update every player of one team after a match: players in `playedIds` gain
 * fatigue, the rest recover. Returns fresh player objects; input is never mutated.
 */
export function updateTeamFatigue(
  players: readonly MatchPlayer[],
  playedIds: ReadonlySet<string>,
): MatchPlayer[] {
  return players.map((p) => ({
    ...p,
    fatigue: nextFatigue(playerFatigue(p), playedIds.has(p.id)),
  }));
}

/**
 * Bucket a 0-100 fatigue into a discrete 0..3 tier for display:
 * 0 fresh, 1 slightly tired, 2 tired, 3 spent (classic PC Fútbol condition dots).
 */
export function fatigueTier(fatigue: number): 0 | 1 | 2 | 3 {
  const f = clampFatigue(fatigue);
  if (f >= 75) return 3;
  if (f >= 50) return 2;
  if (f >= 25) return 1;
  return 0;
}
