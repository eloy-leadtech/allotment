/**
 * Head-to-head player comparison (the classic PC Fútbol "COMPARA" pantalla).
 * Pure and deterministic: given two players and the season's start year it
 * returns the full breakdown — the 10 gameplay attributes, the headline metrics
 * (media + market value) and the descriptive fields — with the better side of
 * each scored row flagged. No RNG, no clock, no mutation: the same two players
 * always compare out the same way.
 */
import type { Attributes, Player, Position } from '@data';
import { marketValue } from './market';
import { playerAge } from './development';

/** Which player is better on a comparison row: 'a', 'b', or 'tie'. */
export type CompareSide = 'a' | 'b' | 'tie';

/**
 * One SCORED comparison row: a numeric metric measured for both players with the
 * better side flagged. `a`/`b` are the raw values (null when unknown, e.g. the
 * reduced-record `calidad`); higher is always better here, so `winner` is 'a'
 * when `a > b`, 'b' when `b > a`, and 'tie' when equal or either value is null.
 */
export interface CompareRow {
  /** Stable machine key (attribute name or metric id). */
  key: string;
  /** Spanish label for the UI. */
  label: string;
  a: number | null;
  b: number | null;
  winner: CompareSide;
}

/**
 * One DESCRIPTIVE field shown side by side with no "better" side, because it has
 * no objective ordering (age, position, height, weight). Values are pre-formatted
 * strings so the UI just prints them.
 */
export interface InfoRow {
  key: string;
  label: string;
  a: string;
  b: string;
}

/** The full comparison breakdown for two players. */
export interface PlayerComparison {
  a: Player;
  b: Player;
  /** The 10 gameplay attributes, in ficha reading order. */
  attributes: CompareRow[];
  /** Headline scored metrics: media and market value (both higher-is-better). */
  metrics: CompareRow[];
  /** Descriptive fields without a winner: edad, posición, altura, peso. */
  info: InfoRow[];
  /** How many of the 10 attributes each side wins (ties counted apart). */
  tally: { a: number; b: number; ties: number };
  /**
   * Overall verdict: whoever wins more attributes; on an attribute tie the higher
   * media decides, then the higher market value, and only then a genuine 'tie'.
   */
  overall: CompareSide;
}

/** The 10 attributes in the ficha's reading order, with Spanish labels. */
const ATTRIBUTE_ORDER: ReadonlyArray<{ key: keyof Attributes; label: string }> = [
  { key: 'calidad', label: 'Calidad' },
  { key: 'remate', label: 'Remate' },
  { key: 'ofensivo', label: 'Ofensivo' },
  { key: 'pase', label: 'Pase' },
  { key: 'velocidad', label: 'Velocidad' },
  { key: 'fisico', label: 'Físico' },
  { key: 'resistencia', label: 'Resistencia' },
  { key: 'agresividad', label: 'Agresividad' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'porteria', label: 'Portería' },
];

const POSITION_LABEL: Record<Position, string> = {
  POR: 'Portero',
  DEF: 'Defensa',
  MED: 'Centrocampista',
  DEL: 'Delantero',
};

/** Higher-is-better winner for two possibly-unknown numbers. */
function winnerOf(a: number | null, b: number | null): CompareSide {
  if (a === null || b === null) return 'tie';
  if (a === b) return 'tie';
  return a > b ? 'a' : 'b';
}

/** Format an optional measurement as "<n> <unit>", or an em dash when unknown. */
function measure(value: number | null, unit: string): string {
  return value === null ? '—' : `${value} ${unit}`;
}

/**
 * Compare two players head to head. `seasonStartYear` is the year the current
 * season kicks off (see `seasonStartYear`), used to age each player and price
 * their market value; pass it in so this stays pure and deterministic.
 */
export function comparePlayers(a: Player, b: Player, seasonStartYear: number): PlayerComparison {
  const attributes: CompareRow[] = ATTRIBUTE_ORDER.map(({ key, label }) => {
    const av = a.atributos[key];
    const bv = b.atributos[key];
    return { key, label, a: av, b: bv, winner: winnerOf(av, bv) };
  });

  const ageA = playerAge(a, seasonStartYear);
  const ageB = playerAge(b, seasonStartYear);
  const valueA = marketValue(a, ageA);
  const valueB = marketValue(b, ageB);

  const metrics: CompareRow[] = [
    { key: 'media', label: 'Media', a: a.media, b: b.media, winner: winnerOf(a.media, b.media) },
    { key: 'valor', label: 'Valor de mercado', a: valueA, b: valueB, winner: winnerOf(valueA, valueB) },
  ];

  const info: InfoRow[] = [
    {
      key: 'edad',
      label: 'Edad',
      a: ageA === null ? '—' : `${ageA} años`,
      b: ageB === null ? '—' : `${ageB} años`,
    },
    { key: 'posicion', label: 'Posición', a: POSITION_LABEL[a.posicion], b: POSITION_LABEL[b.posicion] },
    { key: 'altura', label: 'Altura', a: measure(a.alturaCm, 'cm'), b: measure(b.alturaCm, 'cm') },
    { key: 'peso', label: 'Peso', a: measure(a.pesoKg, 'kg'), b: measure(b.pesoKg, 'kg') },
  ];

  const tally = attributes.reduce(
    (acc, row) => {
      if (row.winner === 'a') acc.a += 1;
      else if (row.winner === 'b') acc.b += 1;
      else acc.ties += 1;
      return acc;
    },
    { a: 0, b: 0, ties: 0 },
  );

  const overall: CompareSide =
    tally.a !== tally.b
      ? tally.a > tally.b
        ? 'a'
        : 'b'
      : winnerOf(a.media, b.media) !== 'tie'
        ? winnerOf(a.media, b.media)
        : winnerOf(valueA, valueB);

  return { a, b, attributes, metrics, info, tally, overall };
}
