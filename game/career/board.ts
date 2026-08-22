/**
 * Board objectives and their end-of-season evaluation — the pressure the club's
 * directors put on the human manager. Pure and deterministic: an objective is a
 * function of the season's squads and division, and its evaluation a function of
 * the final position and promotion/relegation outcome, so the same career always
 * yields the same objective, satisfaction and dismissal risk.
 *
 * Model (a faithful nod to the classic PC Fútbol): at kick-off the board reads
 * your squad's strength relative to your rivals and sets a target — the worst
 * final position it will accept. At season's end your real finish is compared to
 * that target: beating it makes the board happy, just missing it is tolerated,
 * and clearly missing it ANGERS them (an aviso/enfado). Faithful to the classic
 * game, a single missed objective does NOT end your tenure — the board gave a
 * manager margin, so anger accumulates via the confianza meter (see confianza.ts)
 * and only SUSTAINED failure gets you sacked. The one exception is the clear
 * DISASTER of RELEGATION, which the board never tolerates, even in year one.
 */
import type { PromotionOutcome, Division } from './promotion';

/** The flavour of a board objective (drives the UI text). */
export type ObjectiveType =
  | 'title' // win the league
  | 'europe' // qualify for Europe
  | 'promotion' // go up from Segunda
  | 'mid-table' // a safe, respectable finish
  | 'avoid-relegation'; // just survive

/** How happy the board is with a finished season. */
export type Satisfaction = 'contento' | 'normal' | 'enfadado';

/** The season objective the board sets: a type plus the worst acceptable place. */
export interface BoardObjective {
  type: ObjectiveType;
  /** Worst final league position (1-indexed) the board will accept. */
  targetPosition: number;
}

/** The board's verdict on a finished season. */
export interface ObjectiveEvaluation {
  satisfaction: Satisfaction;
  /** True when the board loses patience and ends the manager's tenure. */
  dismissed: boolean;
  /** Actual finish minus target: <=0 met/beaten, >0 fell short by that many places. */
  shortfall: number;
}

/** The whole board relationship carried on the career. */
export interface BoardState {
  /** The objective set for the CURRENT (in-progress) season. */
  objective: BoardObjective;
  /** The board's verdict on the PREVIOUS season, set when a new one begins. */
  lastEvaluation?: ObjectiveEvaluation;
}

/** European qualification places used to frame a "reach Europe" objective. */
export const EUROPEAN_SPOTS = 4;
/** Promotion places used to frame a Segunda "go up" objective. */
export const PROMOTION_SPOTS = 3;
/** Missing the target by up to this many places is tolerated ("normal"). */
export const TOLERANCE = 3;

/** A minimal squad view: only the media of each player is needed for a rating. */
interface RatedSquad {
  id: string;
  players: readonly { media: number }[];
}

/** Mean rating of a club's best 11 players (0 when it has none). */
function squadRating(players: readonly { media: number }[]): number {
  const best = players
    .map((p) => p.media)
    .sort((a, b) => b - a)
    .slice(0, 11);
  if (best.length === 0) return 0;
  return best.reduce((sum, m) => sum + m, 0) / best.length;
}

/**
 * The human's projected finishing position (1-indexed): rank all clubs by squad
 * rating, best first, with a stable id tie-break so it is fully deterministic.
 * A human club absent from the field is treated as the weakest (last).
 */
function projectedPosition(
  teams: readonly RatedSquad[],
  humanTeamId: string,
): number {
  const ranked = [...teams]
    .map((t) => ({ id: t.id, rating: squadRating(t.players) }))
    .sort((a, b) => (b.rating - a.rating) || a.id.localeCompare(b.id));
  const index = ranked.findIndex((t) => t.id === humanTeamId);
  return index < 0 ? teams.length : index + 1;
}

export interface ObjectiveParams {
  teams: readonly RatedSquad[];
  division: Division;
  humanTeamId: string;
  /** Relegation places in the human's current division. */
  relegationSpots: number;
}

/**
 * The objective the board sets for the season from the human's projected finish.
 * Ambition tracks strength: a projected champion is told to win it, a strong
 * side to reach Europe (or go up in Segunda), a mid side to finish safely, and a
 * weak side simply to survive. The target is the worst place the board accepts.
 */
export function computeSeasonObjective(params: ObjectiveParams): BoardObjective {
  const { teams, division, humanTeamId, relegationSpots } = params;
  const n = teams.length;
  const proj = projectedPosition(teams, humanTeamId);
  const safePosition = Math.max(1, n - relegationSpots); // last place clear of the drop

  if (division === 'segunda') {
    if (proj <= PROMOTION_SPOTS) return { type: 'promotion', targetPosition: PROMOTION_SPOTS };
    if (proj <= safePosition) return { type: 'mid-table', targetPosition: safePosition };
    return { type: 'avoid-relegation', targetPosition: safePosition };
  }
  // Primera.
  if (proj <= 1) return { type: 'title', targetPosition: 1 };
  if (proj <= EUROPEAN_SPOTS) return { type: 'europe', targetPosition: EUROPEAN_SPOTS };
  if (proj <= safePosition) return { type: 'mid-table', targetPosition: safePosition };
  return { type: 'avoid-relegation', targetPosition: safePosition };
}

/**
 * The board's verdict on a finished season.
 *
 * - RELEGATION is the one disaster the board never tolerates: it is furious and
 *   the `dismissed` HARD verdict fires (a sack even in the very first season).
 * - Otherwise, beating or meeting the target pleases them, missing it by a
 *   little is tolerated ("normal"), and missing it by a lot ANGERS them
 *   ("enfadado"). Crucially, a missed objective — however large the shortfall —
 *   is NOT an immediate sack: the board gave the manager margin, so the anger is
 *   folded into the confianza meter (see confianza.ts) and only sustained
 *   failure across seasons ends the tenure. `dismissed` here means "the board's
 *   HARD verdict on this one season", which without relegation is always false.
 */
export function evaluateObjective(
  objective: BoardObjective,
  actualPosition: number,
  outcome: PromotionOutcome,
): ObjectiveEvaluation {
  const shortfall = actualPosition - objective.targetPosition;
  if (outcome === 'relegated') {
    return { satisfaction: 'enfadado', dismissed: true, shortfall };
  }
  let satisfaction: Satisfaction;
  if (shortfall <= 0) satisfaction = 'contento';
  else if (shortfall <= TOLERANCE) satisfaction = 'normal';
  else satisfaction = 'enfadado';
  // A single missed objective never sacks on its own — only relegation (above)
  // is a hard verdict. Sustained anger is carried by the confianza meter.
  return { satisfaction, dismissed: false, shortfall };
}
