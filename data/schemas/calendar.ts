import { z } from 'zod';

/**
 * One authentic historical match of a season: its matchday, date, the two clubs
 * (reusing the league's own team ids) and the real final score. The engine
 * replays this score for every match except the human club's (see SPEC decision
 * 2026-10-10 and issue #125), so the table tracks real history.
 */
export const RealFixtureSchema = z.object({
  /** Matchday, 1-indexed (the real `jornada`). */
  jornada: z.number().int().min(1),
  /** Kick-off date, ISO `yyyy-mm-dd`. */
  fechaISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaISO must be yyyy-mm-dd'),
  /** Home team id — must exist in the paired league database. */
  homeId: z.string().min(1),
  /** Away team id — must exist in the paired league database. */
  awayId: z.string().min(1),
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
});
export type RealFixture = z.infer<typeof RealFixtureSchema>;

/**
 * A full season's authentic calendar (pairings + dates + real scores), committed
 * to `data/db/calendario-*.json` and consumed through `getCalendarByLeagueId`.
 */
export const SeasonCalendarSchema = z.object({
  /** The league id this calendar belongs to, e.g. "es-primera-9697". */
  leagueId: z.string().min(1),
  /** Season label, e.g. "96/97". */
  temporada: z.string().min(1),
  /** Provenance of the historical data (auditing / attribution). */
  fuente: z.string().min(1),
  partidos: z.array(RealFixtureSchema).min(1),
});
export type SeasonCalendar = z.infer<typeof SeasonCalendarSchema>;
