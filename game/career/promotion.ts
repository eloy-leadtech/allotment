/**
 * Promotion and relegation between divisions — pure helpers over a final league
 * table. The table is expected to be already ordered best-first (as
 * `computeStandings` returns it).
 *
 * These primitives are division-agnostic; the career layer decides how the human
 * moves between Primera and Segunda based on their own division's result.
 */
import type { StandingRow } from '@engine';

/** Which division a team currently competes in. */
export type Division = 'primera' | 'segunda';

/** What happens to the human team after a season. */
export type PromotionOutcome = 'promoted' | 'relegated' | 'stays';

/** The bottom `spots` team ids (relegation places), worst last. */
export function relegationZone(standings: readonly StandingRow[], spots: number): string[] {
  if (spots <= 0) return [];
  return standings.slice(Math.max(0, standings.length - spots)).map((r) => r.teamId);
}

/** The top `spots` team ids (promotion places), best first. */
export function promotionZone(standings: readonly StandingRow[], spots: number): string[] {
  if (spots <= 0) return [];
  return standings.slice(0, spots).map((r) => r.teamId);
}

export interface FateParams {
  division: Division;
  /** Final table of the human's division, best-first. */
  standings: readonly StandingRow[];
  humanTeamId: string;
  /** Relegation places in Primera. */
  relegationSpots: number;
  /** Promotion places from Segunda. */
  promotionSpots: number;
}

/**
 * The human team's fate given the final table of THEIR division:
 * - in Primera, finishing inside the relegation zone => relegated;
 * - in Segunda, finishing inside the promotion zone => promoted;
 * - otherwise they stay. A team not present in the table also stays.
 */
export function humanFate(params: FateParams): PromotionOutcome {
  const { division, standings, humanTeamId, relegationSpots, promotionSpots } = params;
  const index = standings.findIndex((r) => r.teamId === humanTeamId);
  if (index < 0) return 'stays';
  if (division === 'primera' && index >= standings.length - relegationSpots) return 'relegated';
  if (division === 'segunda' && index < promotionSpots) return 'promoted';
  return 'stays';
}

/** The division the human plays next season, applying their outcome. */
export function nextDivision(current: Division, outcome: PromotionOutcome): Division {
  if (current === 'primera' && outcome === 'relegated') return 'segunda';
  if (current === 'segunda' && outcome === 'promoted') return 'primera';
  return current;
}
