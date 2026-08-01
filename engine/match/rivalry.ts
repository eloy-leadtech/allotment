/**
 * Rivalidades / derbis — clásicos y derbis de la liga española.
 *
 * Un DERBI es un partido entre dos clubes rivales (p.ej. Real Madrid–Barça,
 * Sevilla–Betis). La detección es PURA y determinista: depende solo de los ids
 * de los equipos, así que un partido siempre se marca igual al reproducirse.
 *
 * Los ids de un mismo club cambian de una temporada a otra en los datos
 * (`atletico-de-madrid` vs `at-madrid`, `celta-de-vigo` vs `celta`, …). Para que
 * la tabla de rivalidades sea estable, cada id se pliega antes a una CLAVE
 * CANÓNICA de club mediante `canonicalClub`.
 *
 * Sin React, sin navegador, sin RNG.
 */

/**
 * Alias de ids que apuntan al mismo club a lo largo de las temporadas. La clave
 * es el id tal cual aparece en los datos; el valor, la clave canónica del club.
 * Los ids no listados se usan tal cual (ya son canónicos).
 */
const CLUB_ID_ALIASES: Readonly<Record<string, string>> = {
  'atletico-de-madrid': 'atletico-madrid',
  'at-madrid': 'atletico-madrid',
  'at-madrid-b': 'atletico-madrid-b',
  'athletic-de-bilbao': 'athletic',
  'real-zaragoza': 'zaragoza',
  'celta-de-vigo': 'celta',
  'atletico-osasuna': 'osasuna',
  'sporting-de-gijon': 'sporting',
  'real-oviedo': 'oviedo',
  'racing-de-santander': 'racing',
};

/** Clave canónica de club para un id de equipo (pliega variantes por temporada). */
export function canonicalClub(teamId: string): string {
  return CLUB_ID_ALIASES[teamId] ?? teamId;
}

/** Una rivalidad entre dos clubes, con el nombre del derbi para el teletipo. */
export interface Rivalry {
  /** Clave canónica del primer club. */
  a: string;
  /** Clave canónica del segundo club. */
  b: string;
  /** Nombre del derbi mostrado en la narración/UI. */
  name: string;
}

/**
 * Tabla de derbis (clásicos y derbis regionales de la liga española). El orden
 * de `a`/`b` es irrelevante: la detección es simétrica.
 */
export const RIVALRIES: readonly Rivalry[] = [
  { a: 'real-madrid', b: 'barcelona', name: 'El Clásico' },
  { a: 'atletico-madrid', b: 'real-madrid', name: 'Derbi madrileño' },
  { a: 'sevilla', b: 'betis', name: 'Derbi sevillano' },
  { a: 'athletic', b: 'real-sociedad', name: 'Derbi vasco' },
  { a: 'barcelona', b: 'espanyol', name: 'Derbi barcelonés' },
  { a: 'deportivo', b: 'celta', name: 'Derbi gallego' },
  { a: 'valencia', b: 'levante', name: 'Derbi valenciano' },
  { a: 'sporting', b: 'oviedo', name: 'Derbi asturiano' },
] as const;

/** Clave de par no ordenada, para buscar una rivalidad sin importar el orden. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const RIVALRY_BY_PAIR: ReadonlyMap<string, Rivalry> = new Map(
  RIVALRIES.map((r) => [pairKey(canonicalClub(r.a), canonicalClub(r.b)), r]),
);

/**
 * La rivalidad entre dos equipos (por sus ids), o `null` si no son rivales.
 * Simétrica: `derbyInfo(a, b)` y `derbyInfo(b, a)` devuelven lo mismo.
 */
export function derbyInfo(homeId: string, awayId: string): Rivalry | null {
  return RIVALRY_BY_PAIR.get(pairKey(canonicalClub(homeId), canonicalClub(awayId))) ?? null;
}

/** Si el partido entre estos dos equipos es un derbi. */
export function isDerby(homeId: string, awayId: string): boolean {
  return derbyInfo(homeId, awayId) !== null;
}

/** Nombre del derbi entre dos equipos, o `null` si no lo son. */
export function derbyName(homeId: string, awayId: string): string | null {
  return derbyInfo(homeId, awayId)?.name ?? null;
}
