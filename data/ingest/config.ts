/**
 * Ingest configuration (dev-only). Transforms the reverse-engineered dataset
 * (kept OUTSIDE this repo) into the committed game database.
 */

/** Source dataset (21 of the 22 Primera clubs), in the analysis workspace. */
export const SOURCE_PATH =
  'C:/dev/pcfutbol-analysis/data/eq/PC_Futbol_5_0_Plus_022022_9697.json';

/**
 * The 22nd Primera club (Extremadura) is not in the pack above; it comes from the
 * PC Fútbol 5.0 base edition (EQUIPOS.PKF), extracted into this file.
 */
export const EXTREMADURA_SOURCE = 'C:/dev/pcfutbol-analysis/data/extra/extremadura_9697.json';

/** Output, committed to the repo and consumed by the loader. */
export const OUTPUT_RELATIVE = 'data/db/es-primera-9697.json';

/**
 * The AUTHENTIC Primera 96/97 clubs present in the source pack (21). Derived from
 * the game's own league calendars (JORN101–142 = 22-team Primera; JORN201–238 =
 * Segunda), see analysis note 06-division-9697.md. The 22nd, Extremadura, is
 * merged from EXTREMADURA_SOURCE. (Albacete and Lleida were dropped — Segunda;
 * Hércules kept — Primera.)
 */
export const PRIMERA_9697: readonly string[] = [
  'Barcelona',
  'Deportivo',
  'Zaragoza',
  'Real Madrid',
  'Athletic',
  'Sevilla',
  'Valencia',
  'Racing',
  'Oviedo',
  'Tenerife',
  'Real Sociedad',
  'At. Madrid',
  'Sporting',
  'Celta',
  'Logroñés',
  'Valladolid',
  'Espanyol',
  'Betis',
  'Compostela',
  'Rayo',
  'Hércules',
];

/** Bottom N relegated (info only for now; 2ª is not yet in the database). */
export const RELEGATION_SPOTS = 4;

// --- Temporada 97/98 -------------------------------------------------------

/**
 * Real 97/98 Primera rosters (17 of our fixed 22 clubs), extracted from PC Fútbol
 * 6.0 and division-verified against the game's own JORN1## calendars. The other 5
 * of our 22 were relegated for 97/98 (Sevilla, Logroñés, Rayo, Hércules,
 * Extremadura); the MVP keeps the same 22 clubs (no promotion/relegation yet), so
 * those 5 fall back to their committed 96/97 roster — aging is handled later by
 * the career layer, not at ingest time.
 */
export const SOURCE_PATH_9798 =
  'C:/dev/pcfutbol-analysis/data/extra/primera-9798-source.json';

/** Committed 96/97 database, source of the fallback rosters for the 5 relegated clubs. */
export const FALLBACK_DB_9697 = 'data/db/es-primera-9697.json';

/** Output, committed to the repo and consumed by the loader. */
export const OUTPUT_RELATIVE_9798 = 'data/db/es-primera-9798.json';

// --- Temporada 98/99 -------------------------------------------------------

/**
 * Real 98/99 Primera rosters, extracted from PC Fútbol 7.0 and division-verified
 * against the game's own JORN1## calendars (38 = 20-team Primera). 16 of our fixed
 * 22 clubs are in Primera 98/99; the other 6 (Sevilla, Sporting, Logroñés,
 * Compostela, Rayo, Hércules) fall back to their committed 97/98 roster (one year
 * fresher than before). The 98/99 promoted clubs (Mallorca, Villarreal, Salamanca,
 * Alavés) are ignored while the MVP keeps the same fixed 22.
 */
export const SOURCE_PATH_9899 =
  'C:/dev/pcfutbol-analysis/data/extra/primera-9899-source.json';

/** Committed 97/98 database, source of the fallback rosters for the 6 absent clubs. */
export const FALLBACK_DB_9798 = 'data/db/es-primera-9798.json';

/** Output, committed to the repo and consumed by the loader. */
export const OUTPUT_RELATIVE_9899 = 'data/db/es-primera-9899.json';

// --- Temporada 95/96 (PC Fútbol 4.1) ---------------------------------------

/**
 * 95/96 (Primera 22 + Segunda 20), de PC Fútbol 4.1. Ese motor solo guardaba 4
 * atributos crudos por jugador; los 10 del juego están SINTETIZADOS (modelo 4→10
 * calibrado por rol contra 96/97, error ~4.5, con provenance por jugador). Es su
 * propio conjunto real de clubes (sin fixed-22 ni fallback).
 */
export const SOURCE_PATH_9596_PRIMERA =
  'C:/dev/pcfutbol-analysis/data/extra/primera-9596-source.json';
export const SOURCE_PATH_9596_SEGUNDA =
  'C:/dev/pcfutbol-analysis/data/extra/segunda-9596-source.json';

// --- Selecciones (torneos) -------------------------------------------------

/**
 * Euro 2000 national teams (52), from the FDI late format so the full 10
 * attributes are present. Euro 96 and Mundial 98 are NOT ingested yet (those
 * editions store no usable attributes — parked until the attribute mapping is
 * cracked). Stored in a League container; its `competicion` is a placeholder,
 * the real bracket lives in the tournament layer, not the data.
 */
export const SELECCION_EURO2000_SOURCE =
  'C:/dev/pcfutbol-analysis/data/extra/seleccion-euro2000-source.json';
export const OUTPUT_RELATIVE_EURO2000 = 'data/db/seleccion-euro2000.json';

/**
 * Mundial 98 national teams (contenedor 6.5). Attributes are the REAL values,
 * de-permuted; 799/1310 players are covered, so 4 minor finalists (Arabia, Irán,
 * Corea, Jamaica) get a per-position baseline fill at ingest so the 32-team World
 * Cup is fully playable (documented low fidelity for those four).
 */
export const SELECCION_MUNDIAL98_SOURCE =
  'C:/dev/pcfutbol-analysis/data/extra/seleccion-mundial98-source.json';
export const OUTPUT_RELATIVE_MUNDIAL98 = 'data/db/seleccion-mundial98.json';

// --- Clubes europeos (Champions/UEFA) --------------------------------------

/**
 * Top European clubs per season (from the late FDI packs, 10 attributes). Used
 * for the European competition. Stored in League containers (competicion is a
 * placeholder). Identified by stable EQ id (resolving parse noise / stadium-name
 * aliases at extraction time).
 */
export const EUROPA_SOURCES: ReadonlyArray<{ source: string; id: string; temporada: string; output: string }> = [
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/europa-9899-source.json',
    id: 'europa-9899',
    temporada: '98/99',
    output: 'data/db/europa-9899.json',
  },
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/europa-9900-source.json',
    id: 'europa-9900',
    temporada: '99/00',
    output: 'data/db/europa-9900.json',
  },
];

// --- Segunda División ------------------------------------------------------

/**
 * Segunda División sources, one per season. Extracted with the same JORN2
 * calendar method as Primera. Coverage note: 96/97 and 97/98 come from the
 * classic 32-team pack, so only 10 of ~20-22 Segunda clubs have squads; 98/99
 * comes from the 876-team late pack and is complete (22). This ingest takes
 * whatever clubs the source provides (no fixed set, no fallback).
 */
export const SEGUNDA_SOURCES: ReadonlyArray<{
  source: string;
  id: string;
  temporada: string;
  output: string;
}> = [
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/segunda-9697-source.json',
    id: 'es-segunda-9697',
    temporada: '96/97',
    output: 'data/db/es-segunda-9697.json',
  },
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/segunda-9798-source.json',
    id: 'es-segunda-9798',
    temporada: '97/98',
    output: 'data/db/es-segunda-9798.json',
  },
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/segunda-9899-source.json',
    id: 'es-segunda-9899',
    temporada: '98/99',
    output: 'data/db/es-segunda-9899.json',
  },
  {
    source: 'C:/dev/pcfutbol-analysis/data/extra/segunda-9900-source.json',
    id: 'es-segunda-9900',
    temporada: '99/00',
    output: 'data/db/es-segunda-9900.json',
  },
];
