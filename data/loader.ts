import { LeagueSchema, type League } from './schemas';
import primera9394 from './db/es-primera-9394.json';
import primera9495 from './db/es-primera-9495.json';
import segunda9495 from './db/es-segunda-9495.json';
import primera9596 from './db/es-primera-9596.json';
import segunda9596 from './db/es-segunda-9596.json';
import primera9697 from './db/es-primera-9697.json';
import primera9798 from './db/es-primera-9798.json';
import primera9899 from './db/es-primera-9899.json';
import segunda9697 from './db/es-segunda-9697.json';
import segunda9798 from './db/es-segunda-9798.json';
import segunda9899 from './db/es-segunda-9899.json';
import segunda9900 from './db/es-segunda-9900.json';
import seleccionEuro2000 from './db/seleccion-euro2000.json';
import seleccionMundial98 from './db/seleccion-mundial98.json';
import europa9899 from './db/europa-9899.json';
import europa9900 from './db/europa-9900.json';

/**
 * Parse and validate a raw league object against the schema. Throws a clear
 * ZodError if the data is malformed, so a corrupted database fails loudly (and
 * makes the CI red) instead of silently feeding garbage to the engine.
 */
export function parseLeague(raw: unknown): League {
  return LeagueSchema.parse(raw);
}

const cache = new Map<string, League>();

/** Load the committed Liga española 93/94 database (validated, memoized). */
export function loadPrimera9394(): League {
  let league = cache.get('9394');
  if (!league) {
    league = parseLeague(primera9394);
    cache.set('9394', league);
  }
  return league;
}

/** Load the committed Liga española 94/95 database (validated, memoized). */
export function loadPrimera9495(): League {
  let league = cache.get('9495');
  if (!league) {
    league = parseLeague(primera9495);
    cache.set('9495', league);
  }
  return league;
}

/** Load the committed Liga española 95/96 database (validated, memoized). */
export function loadPrimera9596(): League {
  let league = cache.get('9596');
  if (!league) {
    league = parseLeague(primera9596);
    cache.set('9596', league);
  }
  return league;
}

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
export const loadSegunda9495 = (): League => memoize('seg-9495', segunda9495);
export const loadSegunda9596 = (): League => memoize('seg-9596', segunda9596);
export const loadSegunda9697 = (): League => memoize('seg-9697', segunda9697);
export const loadSegunda9798 = (): League => memoize('seg-9798', segunda9798);
export const loadSegunda9899 = (): League => memoize('seg-9899', segunda9899);
export const loadSegunda9900 = (): League => memoize('seg-9900', segunda9900);

/** Load the Euro 2000 national teams (a squad container, not a real league). */
export const loadSeleccionEuro2000 = (): League => memoize('sel-euro2000', seleccionEuro2000);

/** Load the Mundial 98 national teams (a squad container, not a real league). */
export const loadSeleccionMundial98 = (): League => memoize('sel-mundial98', seleccionMundial98);

/** Load a European clubs database (a squad container for Champions/UEFA). */
export const loadEuropa9899 = (): League => memoize('europa-9899', europa9899);
export const loadEuropa9900 = (): League => memoize('europa-9900', europa9900);
