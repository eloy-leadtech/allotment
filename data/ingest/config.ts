/**
 * Ingest configuration (dev-only). Transforms the reverse-engineered dataset
 * (kept OUTSIDE this repo) into the committed game database.
 */

/** Source dataset, in the analysis workspace (not part of the repo/CI). */
export const SOURCE_PATH =
  'C:/dev/pcfutbol-analysis/data/eq/PC_Futbol_5_0_Plus_022022_9697.json';

/** Output, committed to the repo and consumed by the loader. */
export const OUTPUT_RELATIVE = 'data/db/es-primera-9697.json';

/**
 * PROVISIONAL whitelist of Primera 96/97 clubs — currently the first 22 teams by
 * pack index in the source. The pack order is NOT guaranteed to be a clean
 * Primera/Segunda split, so this list is PENDING the owner's confirmation of the
 * real Primera 96/97 roster (e.g. Albacete/Lleida vs Extremadura/Hércules).
 * Editing this list + re-running `npm run ingest` regenerates the database.
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
  'Albacete',
  'Sporting',
  'Celta',
  'Logroñés',
  'Valladolid',
  'Espanyol',
  'Betis',
  'Compostela',
  'Rayo',
  'Lleida',
];

/** Bottom N relegated (info only for now; 2ª is not yet in the database). */
export const RELEGATION_SPOTS = 4;
