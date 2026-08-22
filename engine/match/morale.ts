/**
 * Form (forma) and morale (moral) — the PC Fútbol "streak" mechanic.
 *
 * Both are scores in [0, 100] with 50 as neutral. FORM is short-term and swingy
 * (a hot or cold streak); MORALE is medium-term and steadier. They evolve
 * deterministically from match outcomes (no RNG) so a replayed season always
 * reconstructs the exact same values, and they feed a SMALL multiplier into a
 * player's effective ratings — a team on a good run performs a touch better,
 * never enough to distort the ~2.6 goals/game balance.
 *
 * Pure and framework-free: no React, no browser, no RNG.
 */
import type { MatchPlayer } from './types';

export const NEUTRAL_FORM = 50;
export const NEUTRAL_MORALE = 50;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** Max fraction FORM adds to/removes from a rating at the extremes (±6%). */
const FORM_WEIGHT = 0.06;
/** Max fraction MORALE adds to/removes from a rating at the extremes (±4%). */
const MORALE_WEIGHT = 0.04;

/** How hard FORM is pulled back toward neutral each matchday played (regression). */
const FORM_REGRESSION = 0.15;
/** MORALE regresses far more slowly than form. */
const MORALE_REGRESSION = 0.06;

/** FORM deltas for a player who took part in the match. */
const FORM_WIN = 9;
const FORM_DRAW = 2;
const FORM_LOSS = -8;
const FORM_PER_GOAL = 4;
/** A benched player loses a little form (rust). */
const FORM_BENCH_PENALTY = 3;

/** MORALE deltas for a player who took part in the match. */
const MORALE_WIN = 5;
const MORALE_DRAW = 0;
const MORALE_LOSS = -5;
/** MORALE deltas for a benched player (still affected by the club's result). */
const MORALE_BENCH_WIN = 1;
const MORALE_BENCH_DRAW = -1;
const MORALE_BENCH_LOSS = -2;

/** Clamp to the score range and round to an integer. */
export function clampScore(value: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(value)));
}

/** A player's form, defaulting to neutral when unset. */
export function playerForm(p: Pick<MatchPlayer, 'form'>): number {
  return p.form ?? NEUTRAL_FORM;
}

/** A player's morale, defaulting to neutral when unset. */
export function playerMorale(p: Pick<MatchPlayer, 'morale'>): number {
  return p.morale ?? NEUTRAL_MORALE;
}

/**
 * The performance multiplier a player's form+morale apply to their effective
 * ratings. Exactly 1 at neutral (so neutral players never change any result),
 * bounded to roughly [0.90, 1.10] at the extremes.
 */
export function performanceMultiplier(
  form: number = NEUTRAL_FORM,
  morale: number = NEUTRAL_MORALE,
): number {
  const f = (clampScore(form) - NEUTRAL_FORM) / (SCORE_MAX - NEUTRAL_FORM); // [-1, 1]
  const m = (clampScore(morale) - NEUTRAL_MORALE) / (SCORE_MAX - NEUTRAL_MORALE); // [-1, 1]
  return 1 + f * FORM_WEIGHT + m * MORALE_WEIGHT;
}

/** The team result from a single player's perspective. */
export type MatchOutcome = 'win' | 'draw' | 'loss';

/** What happened to one player in one match — the input to the form/morale update. */
export interface PlayerMatchContext {
  /** Whether the player was in the starting XI. */
  played: boolean;
  /** The team's result. */
  outcome: MatchOutcome;
  /** Goals this player scored in the match. */
  goalsScored: number;
}

/** Derive the outcome for a team from its goals for/against. */
export function outcomeOf(teamGoals: number, rivalGoals: number): MatchOutcome {
  if (teamGoals > rivalGoals) return 'win';
  if (teamGoals < rivalGoals) return 'loss';
  return 'draw';
}

/** Evolve a player's FORM by one matchday. */
export function nextForm(form: number, ctx: PlayerMatchContext): number {
  const regressed = form + (NEUTRAL_FORM - form) * FORM_REGRESSION;
  if (!ctx.played) return clampScore(regressed - FORM_BENCH_PENALTY);
  const resultDelta = ctx.outcome === 'win' ? FORM_WIN : ctx.outcome === 'draw' ? FORM_DRAW : FORM_LOSS;
  return clampScore(regressed + resultDelta + ctx.goalsScored * FORM_PER_GOAL);
}

/** Evolve a player's MORALE by one matchday. */
export function nextMorale(morale: number, ctx: PlayerMatchContext): number {
  const regressed = morale + (NEUTRAL_MORALE - morale) * MORALE_REGRESSION;
  if (!ctx.played) {
    const d =
      ctx.outcome === 'win' ? MORALE_BENCH_WIN : ctx.outcome === 'draw' ? MORALE_BENCH_DRAW : MORALE_BENCH_LOSS;
    return clampScore(regressed + d);
  }
  const d = ctx.outcome === 'win' ? MORALE_WIN : ctx.outcome === 'draw' ? MORALE_DRAW : MORALE_LOSS;
  return clampScore(regressed + d);
}

/**
 * Update every player of one team after a match. Players in `playedIds` count as
 * having played; `goalsByPlayer` maps a player id to the goals they scored.
 * Returns fresh player objects; the input is never mutated.
 */
export function updateTeamFormMorale(
  players: readonly MatchPlayer[],
  playedIds: ReadonlySet<string>,
  teamGoals: number,
  rivalGoals: number,
  goalsByPlayer: ReadonlyMap<string, number>,
): MatchPlayer[] {
  const outcome = outcomeOf(teamGoals, rivalGoals);
  return players.map((p) => {
    const ctx: PlayerMatchContext = {
      played: playedIds.has(p.id),
      outcome,
      goalsScored: goalsByPlayer.get(p.id) ?? 0,
    };
    return { ...p, form: nextForm(playerForm(p), ctx), morale: nextMorale(playerMorale(p), ctx) };
  });
}

/**
 * Bucket a 0-100 score into a discrete -3..+3 tier (classic PC Fútbol arrows):
 * 0 is neutral, positive means a good streak, negative a bad one. Shared by form
 * and morale for display.
 */
export function scoreTier(score: number): -3 | -2 | -1 | 0 | 1 | 2 | 3 {
  const d = clampScore(score) - 50;
  if (d >= 20) return 3;
  if (d >= 11) return 2;
  if (d >= 4) return 1;
  if (d <= -20) return -3;
  if (d <= -11) return -2;
  if (d <= -4) return -1;
  return 0;
}

/** Mean morale of a squad (the "vestuario" morale). Neutral for an empty squad. */
export function squadMorale(players: readonly MatchPlayer[]): number {
  if (players.length === 0) return NEUTRAL_MORALE;
  const sum = players.reduce((acc, p) => acc + playerMorale(p), 0);
  return Math.round(sum / players.length);
}
