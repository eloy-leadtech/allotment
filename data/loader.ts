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

/**
 * Validate-and-memoize cache. The Zod-parsed League is stored ONCE (parsing is
 * the expensive part), but it is treated as an immutable master template that is
 * NEVER handed out directly.
 */
const cache = new Map<string, League>();

/**
 * Load a league from the committed JSON: validate-and-cache the master ONCE, then
 * return a fresh DEEP COPY on every call.
 *
 * Why the copy: the career/season layers take ownership of the loaded teams and
 * players (e.g. `players: t.jugadores`) and evolve them across seasons. Handing
 * out the shared cached instance would let one career (or one test) corrupt the
 * template for every later one — an order-dependent, seed-dependent source of
 * flakiness. `structuredClone` gives each caller its own private copy, so the
 * cache can never be mutated and loads stay cheap (no re-parse/re-validate).
 */
function loadCached(key: string, raw: unknown): League {
  let master = cache.get(key);
  if (!master) {
    master = parseLeague(raw);
    cache.set(key, master);
  }
  return structuredClone(master);
}

/** Load the committed Liga española 93/94 database (validated, fresh copy per call). */
export const loadPrimera9394 = (): League => loadCached('9394', primera9394);

/** Load the committed Liga española 94/95 database (validated, fresh copy per call). */
export const loadPrimera9495 = (): League => loadCached('9495', primera9495);

/** Load the committed Liga española 95/96 database (validated, fresh copy per call). */
export const loadPrimera9596 = (): League => loadCached('9596', primera9596);

/** Load the committed Liga española 96/97 database (validated, fresh copy per call). */
export const loadPrimera9697 = (): League => loadCached('9697', primera9697);

/** Load the committed Liga española 97/98 database (validated, fresh copy per call). */
export const loadPrimera9798 = (): League => loadCached('9798', primera9798);

/** Load the committed Liga española 98/99 database (validated, fresh copy per call). */
export const loadPrimera9899 = (): League => loadCached('9899', primera9899);

/** Load a committed Segunda División database (validated, fresh copy per call). */
export const loadSegunda9495 = (): League => loadCached('seg-9495', segunda9495);
export const loadSegunda9596 = (): League => loadCached('seg-9596', segunda9596);
export const loadSegunda9697 = (): League => loadCached('seg-9697', segunda9697);
export const loadSegunda9798 = (): League => loadCached('seg-9798', segunda9798);
export const loadSegunda9899 = (): League => loadCached('seg-9899', segunda9899);
export const loadSegunda9900 = (): League => loadCached('seg-9900', segunda9900);

/** Load the Euro 2000 national teams (a squad container, not a real league). */
export const loadSeleccionEuro2000 = (): League => loadCached('sel-euro2000', seleccionEuro2000);

/** Load the Mundial 98 national teams (a squad container, not a real league). */
export const loadSeleccionMundial98 = (): League => loadCached('sel-mundial98', seleccionMundial98);

/** Load a European clubs database (a squad container for Champions/UEFA). */
export const loadEuropa9899 = (): League => loadCached('europa-9899', europa9899);
export const loadEuropa9900 = (): League => loadCached('europa-9900', europa9900);
