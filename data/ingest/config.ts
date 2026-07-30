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
