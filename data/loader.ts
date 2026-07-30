import { LeagueSchema, type League } from './schemas';
import primera9697 from './db/es-primera-9697.json';

/**
 * Parse and validate a raw league object against the schema. Throws a clear
 * ZodError if the data is malformed, so a corrupted database fails loudly (and
 * makes the CI red) instead of silently feeding garbage to the engine.
 */
export function parseLeague(raw: unknown): League {
  return LeagueSchema.parse(raw);
}

let cached: League | null = null;

/** Load the committed Liga española 96/97 database (validated, memoized). */
export function loadPrimera9697(): League {
  cached ??= parseLeague(primera9697);
  return cached;
}
