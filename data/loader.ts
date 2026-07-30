import { LeagueSchema, type League } from './schemas';
import primera9697 from './db/es-primera-9697.json';
import primera9798 from './db/es-primera-9798.json';
import primera9899 from './db/es-primera-9899.json';
import segunda9697 from './db/es-segunda-9697.json';
import segunda9798 from './db/es-segunda-9798.json';
import segunda9899 from './db/es-segunda-9899.json';
import segunda9900 from './db/es-segunda-9900.json';
import seleccionEuro2000 from './db/seleccion-euro2000.json';

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

/** Load the committed Liga española 98/99 database (validated, memoized). */
export function loadPrimera9899(): League {
  let league = cache.get('9899');
  if (!league) {
    league = parseLeague(primera9899);
    cache.set('9899', league);
  }
  return league;
}

function memoize(key: string, raw: unknown): League {
  let league = cache.get(key);
  if (!league) {
    league = parseLeague(raw);
    cache.set(key, league);
  }
  return league;
}

/** Load a committed Segunda División database (validated, memoized). */
export const loadSegunda9697 = (): League => memoize('seg-9697', segunda9697);
export const loadSegunda9798 = (): League => memoize('seg-9798', segunda9798);
export const loadSegunda9899 = (): League => memoize('seg-9899', segunda9899);
export const loadSegunda9900 = (): League => memoize('seg-9900', segunda9900);

/** Load the Euro 2000 national teams (a squad container, not a real league). */
export const loadSeleccionEuro2000 = (): League => memoize('sel-euro2000', seleccionEuro2000);
