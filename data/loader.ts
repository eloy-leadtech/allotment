import { LeagueSchema, type League } from './schemas';
import primera9697 from './db/es-primera-9697.json';
import primera9798 from './db/es-primera-9798.json';

/**
 * Parse and validate a raw league object against the schema. Throws a clear
 * ZodError if the data is malformed, so a corrupted database fails loudly (and
 * makes the CI red) instead of silently feeding garbage to the engine.
 */
export function parseLeague(raw: unknown): League {
  return LeagueSchema.parse(raw);
}

const cache = new Map<string, League>();

/** Load the committed Liga española 96/97 database (validated, memoized). */
export function loadPrimera9697(): League {
  let league = cache.get('9697');
  if (!league) {
    league = parseLeague(primera9697);
    cache.set('9697', league);
  }
  return league;
}

/** Load the committed Liga española 97/98 database (validated, memoized). */
export function loadPrimera9798(): League {
  let league = cache.get('9798');
  if (!league) {
    league = parseLeague(primera9798);
    cache.set('9798', league);
  }
  return league;
}
