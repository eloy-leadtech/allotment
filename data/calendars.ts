import { SeasonCalendarSchema, type SeasonCalendar } from './schemas';
import calendario9697 from './db/calendario-es-primera-9697.json';

/**
 * Registry of committed authentic calendars, keyed by the league id they belong
 * to. Adding a season's real calendar = adding its generated JSON and one entry
 * here (no engine changes). Only Primera 96/97 for now (issue #125).
 */
const RAW_BY_LEAGUE: Readonly<Record<string, unknown>> = {
  'es-primera-9697': calendario9697,
};

/** Validate-and-memoize cache (parsing is the expensive part). */
const cache = new Map<string, SeasonCalendar>();

/**
 * The authentic calendar for a league id (validated), or `undefined` when none is
 * committed — the caller then falls back to the generated round-robin. Returned
 * value is the shared validated master: it is read-only, never mutated.
 */
export function getCalendarByLeagueId(leagueId: string): SeasonCalendar | undefined {
  const cached = cache.get(leagueId);
  if (cached) return cached;
  const raw = RAW_BY_LEAGUE[leagueId];
  if (raw === undefined) return undefined;
  const parsed = SeasonCalendarSchema.parse(raw);
  cache.set(leagueId, parsed);
  return parsed;
}

/** Whether an authentic calendar is committed for a league id. */
export function hasRealCalendar(leagueId: string): boolean {
  return leagueId in RAW_BY_LEAGUE;
}
