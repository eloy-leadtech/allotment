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
