/**
 * Full historical catalogue (BDFutbol → game format). The manifest
 * (`catalog/catalog.json`, ~210 KB) is bundled so the game knows every league
 * that exists without downloading the 284 MB of season data. The season files
 * themselves are fetched on demand from `CATALOG_BASE` and cached in memory,
 * so only the leagues the player actually opens are ever loaded.
 *
 * Locally, `CATALOG_BASE` is served by the Vite dev plugin from the folder in
 * `VITE_DATA_DIR` (see vite.config.ts). Hosting can be repointed later without
 * touching this module.
 */
import manifest from './catalog/catalog.json';
import { LeagueSchema, type League } from './schemas';

/** One league-season in the catalogue manifest. */
export interface CatalogEntry {
  id: string; // e.g. "esp-1-1996-97"
  pais: string; // "España"
  country: string; // "ESP"
  division: string; // "1" | "2"
  temporada: string; // "96/97"
  season: string; // "1996-97"
  nombre: string; // "Primera División"
  equipos: number;
  jugadores: number;
  file: string; // "esp-1-1996-97.json"
}

interface Manifest {
  generated: number;
  leagues: CatalogEntry[];
}

const CATALOG: Manifest = manifest as Manifest;

/** URL base the browser fetches season files from. `/catalogo/` in dev. */
export const CATALOG_BASE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_DATA_BASE ?? '/catalogo/';

/** Every league-season available, in manifest order (by country, division, season). */
export function catalogLeagues(): readonly CatalogEntry[] {
  return CATALOG.leagues;
}

/** The distinct countries present, as {code, nombre}, in catalogue order. */
export function catalogCountries(): { code: string; nombre: string }[] {
  const seen = new Map<string, string>();
  for (const e of CATALOG.leagues) if (!seen.has(e.country)) seen.set(e.country, e.pais);
  return [...seen].map(([code, nombre]) => ({ code, nombre }));
}

/** Leagues for a country, optionally filtered by division ("1"/"2"). */
export function catalogFor(country: string, division?: string): CatalogEntry[] {
  return CATALOG.leagues.filter(
    (e) => e.country === country && (division == null || e.division === division),
  );
}

/** Look up a single catalogue entry by league id. */
export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.leagues.find((e) => e.id === id);
}

const cache = new Map<string, League>();

/**
 * Fetch, validate and cache a season's league database by id. Async because the
 * data lives outside the bundle; downstream engine code stays synchronous by
 * reading the cache via {@link cachedLeague} once this has resolved.
 */
export async function fetchLeague(id: string): Promise<League> {
  const hit = cache.get(id);
  if (hit) return hit;
  const entry = catalogEntry(id);
  if (!entry) throw new Error(`Liga desconocida en el catálogo: ${id}`);
  const res = await fetch(CATALOG_BASE + entry.file);
  if (!res.ok) throw new Error(`No se pudo cargar ${id}: HTTP ${res.status}`);
  const league = LeagueSchema.parse(await res.json());
  cache.set(id, league);
  return league;
}

/** Synchronous cache read; returns undefined if the league wasn't prefetched. */
export function cachedLeague(id: string): League | undefined {
  return cache.get(id);
}

/** Test/seed hook: inject a league into the cache without fetching. */
export function primeLeagueCache(id: string, league: League): void {
  cache.set(id, league);
}
