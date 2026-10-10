import type { Fixture } from './types';

/**
 * One authentic historical match, as handed to the engine by the data layer
 * (already mapped to our own team ids). A plain structural shape so the engine
 * stays decoupled from the data layer's Zod types.
 */
export interface RealMatchInput {
  /** Matchday, 1-indexed (the real `jornada`). */
  round: number;
  homeId: string;
  awayId: string;
  /** Real kick-off date, ISO `yyyy-mm-dd`. */
  date?: string;
  /** Real final score; both goals must be given together or neither. */
  homeGoals?: number;
  awayGoals?: number;
}

/**
 * Build a calendar from an authentic historical fixture list, preserving its
 * pairings, dates and real scores. The counterpart of `buildCalendar` (the seeded
 * round-robin), used when real data exists for a season; `buildCalendar` stays the
 * fallback when it does not.
 *
 * Pure and deterministic: a straight projection of the input, input order kept
 * (the match seed derives from round/home/away, not position, so order never
 * affects simulated results).
 */
export function buildCalendarFromFixtures(matches: readonly RealMatchInput[]): Fixture[] {
  if (matches.length === 0) {
    throw new Error('A real calendar needs at least one fixture');
  }
  return matches.map((m) => {
    const fixture: Fixture = { round: m.round, homeId: m.homeId, awayId: m.awayId };
    if (m.date !== undefined) {
      fixture.date = m.date;
    }
    if (m.homeGoals !== undefined && m.awayGoals !== undefined) {
      fixture.historicalScore = { homeGoals: m.homeGoals, awayGoals: m.awayGoals };
    }
    return fixture;
  });
}
