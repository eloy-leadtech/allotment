/**
 * Hidden potential and fallible scouting. Pure and deterministic: every value is
 * derived from a seed via `hashSeed`, never from `Math.random`/`Date.now`, so a
 * given player + seed always yields the same ceiling, the same overall and the
 * same scout report on every machine.
 *
 * Three concerns live here:
 *  1. `synthesizePotential` invents a per-attribute ceiling that the aging curve
 *     in `development.ts` will honour (it never grows an attribute past it).
 *  2. `potentialOverall` collapses that ceiling into a single 0-99 by weighting
 *     the attributes that matter for the player's position.
 *  3. `scoutEstimate` models a scout who reports a RANGE for that overall — a
 *     range that narrows with observation but carries a stable personal bias and
 *     therefore may fail to contain the true value.
 */
import { createRng, hashSeed, type Rng } from '@engine';
import type { Attributes, Player, Position } from '@data';

/** Clamp to the classic 0-99 rating scale (integer). */
const clampRating = (v: number): number => Math.max(0, Math.min(99, Math.round(v)));

/**
 * Fixed attribute order so the RNG is consumed identically for every player,
 * making `synthesizePotential` reproducible regardless of object iteration.
 */
const ATTR_KEYS: readonly (keyof Attributes)[] = [
  'calidad',
  'agresividad',
  'resistencia',
  'velocidad',
  'fisico',
  'remate',
  'ofensivo',
  'pase',
  'entrada',
  'porteria',
];

/**
 * Headroom budget bounds. Every attribute gets at least `MIN_HEADROOM` of
 * possible ceiling above its current value; the most "promising" players reach
 * up to `MAX_HEADROOM`. The budget is then split randomly per attribute.
 */
const MIN_HEADROOM = 4;
const MAX_HEADROOM = 30;

/**
 * Synthesize a potential ceiling for every attribute.
 *
 * Criterion for the margin: we treat a player's curated `media` (and `calidad`
 * when present) as the club/scout's read on how much room the player has — a
 * higher-rated prospect is modelled as having a taller ceiling on average. So
 * the per-player headroom budget scales linearly from `MIN_HEADROOM` (low
 * media/calidad) to `MAX_HEADROOM` (top media/calidad), and each attribute draws
 * an independent slice of that budget. The result is ALWAYS `>= atributo actual`
 * and `<= 99`, keeping it coherent with the aging curve that never grows past it.
 *
 * Deterministic via `hashSeed(seed, 'potential', player.id)`.
 */
export function synthesizePotential(player: Player, seed: number): Attributes {
  const rng = createRng(hashSeed(seed, 'potential', player.id));
  const attrs = player.atributos;

  // "Promise" in [0,1]: blend of media and calidad (falls back to media when
  // calidad is absent in the reduced record variant).
  const calidad = attrs.calidad;
  const promiseRaw = (player.media + (calidad ?? player.media)) / 2 / 99;
  const promise = Math.max(0, Math.min(1, promiseRaw));
  const budget = MIN_HEADROOM + promise * (MAX_HEADROOM - MIN_HEADROOM);

  // Build a fresh object; never mutate the input.
  const out: Attributes = { ...attrs };
  for (const key of ATTR_KEYS) {
    const current = attrs[key];
    const draw = rng.next01(); // consumed for every key => stable ordering
    if (current === null) {
      // Only `calidad` is nullable; keep its ceiling null too (nothing to cap).
      out.calidad = null;
      continue;
    }
    const margin = Math.round(draw * budget);
    out[key] = clampRating(Math.max(current, current + margin));
  }
  return out;
}

/**
 * Position weights for the potential overall. Mirrors the spec: goalkeepers are
 * dominated by `porteria`; centre-backs by `entrada`/`fisico`; midfielders by
 * `pase`/`ofensivo`; forwards by `remate`/`ofensivo`. Each map is a weighted
 * mean over 0-99 ratings, so the result is itself in [0,99].
 */
const OVERALL_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  POR: { porteria: 6, fisico: 1, velocidad: 1, entrada: 0.5 },
  DEF: { entrada: 4, fisico: 3, velocidad: 1.5, pase: 1, remate: 0.5 },
  MED: { pase: 4, ofensivo: 3, entrada: 1, remate: 1, velocidad: 1 },
  DEL: { remate: 4, ofensivo: 3, velocidad: 1.5, pase: 1, fisico: 0.5 },
};

/**
 * Collapse a potential-attribute set into a single 0-99 potential overall,
 * weighting the attributes that define the position (see `OVERALL_WEIGHTS`).
 * Because it is a weighted mean of the ratings, raising any key attribute raises
 * the overall. Null attributes are skipped so the mean stays well-defined.
 */
export function potentialOverall(potencial: Attributes, posicion: Position): number {
  const weights = OVERALL_WEIGHTS[posicion];
  let sum = 0;
  let wsum = 0;
  for (const key of Object.keys(weights) as (keyof Attributes)[]) {
    const w = weights[key] ?? 0;
    const value = potencial[key];
    if (value === null) continue;
    sum += w * value;
    wsum += w;
  }
  return wsum > 0 ? clampRating(sum / wsum) : 0;
}

/** A scout's estimated range for a player's true potential overall. */
export interface ScoutRange {
  low: number;
  high: number;
}

/** Widest half-width (at zero observed seasons) and how fast it narrows. */
const HALF_BASE = 18;
const NARROW_RATE = 0.5;
/** Largest stable per-player over/undervaluation the scout carries. */
const MAX_BIAS = 12;
/** How much each ojeador level tightens the band and shrinks the bias. */
const SCOUT_PRECISION_PER_LEVEL = 0.12;
/** Floor on the precision factor so even an elite ojeador keeps some uncertainty. */
const SCOUT_PRECISION_FLOOR = 0.4;

/**
 * The precision factor (in [floor, 1]) a hired OJEADOR of `scoutLevel` (0-5) applies
 * to a scout report: it multiplies BOTH the report's half-width and its personal
 * bias, so a better ojeador delivers a tighter band centred closer to the truth —
 * less error. Level 0 (no ojeador) leaves the report untouched (factor 1).
 */
export function scoutPrecisionFactor(scoutLevel: number): number {
  return Math.max(SCOUT_PRECISION_FLOOR, 1 - scoutLevel * SCOUT_PRECISION_PER_LEVEL);
}

/**
 * A fallible scout's estimate of `potentialOverall(potencial, posicion)`.
 *
 * The report is a range `[low, high]` in 0-99 with `low <= high`. Two effects
 * combine:
 *  - A STABLE per-player bias (sign and magnitude up to `MAX_BIAS`), seeded
 *    without `observedSeasons`, so a scout consistently over- or under-rates a
 *    given player no matter how long they watch him.
 *  - A half-width that starts at `HALF_BASE` and shrinks as `observedSeasons`
 *    grows, so more observation means a tighter — but not necessarily more
 *    accurate — range.
 *
 * Because the bias persists while the width shrinks, a confident narrow range
 * can sit entirely off the true value: the estimate CAN be wrong, and more so
 * the more sure it looks. Deterministic via
 * `hashSeed(seed, 'scout', player.id, observedSeasons)`.
 */
export function scoutEstimate(
  player: Player,
  potencial: Attributes,
  observedSeasons: number,
  seed: number,
  scoutLevel = 0,
): ScoutRange {
  const truth = potentialOverall(potencial, player.posicion);
  // A hired ojeador tightens the band and shrinks the bias (1 = no ojeador).
  const precision = scoutPrecisionFactor(scoutLevel);

  // Stable bias: independent of observedSeasons so it never "washes out".
  const biasRng: Rng = createRng(hashSeed(seed, 'scout', player.id));
  const biasSign = biasRng.next01() < 0.5 ? -1 : 1;
  const biasMag = biasRng.next01() * MAX_BIAS;
  const bias = biasSign * biasMag * precision;

  // Observation-dependent noise and width.
  const noiseRng: Rng = createRng(hashSeed(seed, 'scout', player.id, observedSeasons));
  const half = (HALF_BASE / (1 + observedSeasons * NARROW_RATE)) * precision;
  const jitter = (noiseRng.next01() * 2 - 1) * half * 0.4;

  const center = truth + bias + jitter;
  const a = clampRating(center - half);
  const b = clampRating(center + half);
  return { low: Math.min(a, b), high: Math.max(a, b) };
}
