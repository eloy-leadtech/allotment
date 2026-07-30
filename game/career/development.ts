/**
 * Player development, aging and retirement across career seasons. Pure and
 * deterministic: each player evolves under its OWN seeded RNG
 * (`hashSeed(seed,'dev',seasonNumber,playerId)`), so results are independent of
 * processing order and reproducible on every machine.
 *
 * CRITICAL: `media` is a CURATED value, not derivable from the attributes. So we
 * never recompute it from scratch — we move it by the SAME delta its
 * position-weighted core attributes moved (`coreMean` before vs after). This
 * preserves the authentic baseline while letting evolution nudge it.
 */
import { createRng, hashSeed, type Rng } from '@engine';
import type { Attributes, Player, Position } from '@data';

/** Attributes that fade with age (athleticism). */
const PHYSICAL: readonly (keyof Attributes)[] = ['agresividad', 'resistencia', 'velocidad', 'fisico'];
/** Attributes that grow/hold longer (craft). `calidad` is handled separately (nullable). */
const TECHNICAL: readonly (keyof Attributes)[] = ['remate', 'ofensivo', 'pase', 'entrada', 'porteria'];

/**
 * Position weights for the core mean that drives `media`. Only ever reference
 * non-null attributes so the mean is always well-defined.
 */
const POSITION_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  POR: { porteria: 6, velocidad: 1, fisico: 1, entrada: 0.5 },
  DEF: { entrada: 4, fisico: 2, velocidad: 2, pase: 1.5, remate: 0.5 },
  MED: { pase: 4, ofensivo: 2.5, entrada: 1.5, remate: 1.5, velocidad: 1 },
  DEL: { remate: 4, ofensivo: 3, velocidad: 2, pase: 1, fisico: 1 },
};

export interface DevelopmentContext {
  /** Career master seed. */
  seed: number;
  /** 1-indexed career season being entered (the season whose start ages the player). */
  seasonNumber: number;
  /** Calendar start year of that season, e.g. 1997 for "97/98". */
  seasonStartYear: number;
}

export interface DevelopmentResult {
  /** The evolved player (unchanged if retired). */
  player: Player;
  retired: boolean;
  /** Age at the season start, or null when the birth date is unknown. */
  age: number | null;
}

/** "96/97" -> 1996, "00/01" -> 2000. Century inferred (>=50 => 1900s). */
export function seasonStartYear(temporada: string): number {
  const match = /^(\d{2})\/(\d{2})$/.exec(temporada);
  if (!match) throw new Error(`Unrecognized season label: ${temporada}`);
  const yy = Number(match[1]);
  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

/** Age at a season's start; null when the birth date is unknown. */
export function playerAge(player: Player, atSeasonStartYear: number): number | null {
  if (!player.fechaNacimiento) return null;
  const year = Number(player.fechaNacimiento.slice(0, 4));
  if (!Number.isFinite(year) || year <= 0) return null;
  return atSeasonStartYear - year;
}

const clampRating = (v: number): number => Math.max(0, Math.min(99, Math.round(v)));

/** Weighted mean of the position's core attributes (all non-null). */
function coreMean(attrs: Attributes, pos: Position): number {
  const weights = POSITION_WEIGHTS[pos];
  let sum = 0;
  let wsum = 0;
  for (const key of Object.keys(weights) as (keyof Attributes)[]) {
    const w = weights[key] ?? 0;
    const value = attrs[key];
    if (value === null) continue;
    sum += w * value;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 0;
}

/**
 * Central per-season trend (before jitter) for physical and technical attributes.
 * Growth while young, plateau at peak, accelerating decline afterwards.
 */
function ageTrend(age: number): { phys: number; tech: number } {
  if (age <= 20) return { phys: 2, tech: 2.5 };
  if (age <= 23) return { phys: 1, tech: 1.5 };
  if (age <= 27) return { phys: 0, tech: 0.3 };
  if (age <= 30) return { phys: -1, tech: 0 };
  if (age <= 32) return { phys: -2, tech: -0.7 };
  if (age <= 34) return { phys: -3, tech: -1.3 };
  return { phys: -4, tech: -2 };
}

/** Goalkeepers age more gently and later; their craft (porteria) especially endures. */
const GK_TREND_FACTOR = 0.6;

/**
 * Retirement probability this season. The window opens later for goalkeepers,
 * who play on longer, and ramps to certainty across a few seasons.
 */
function retirementChance(age: number, esPortero: boolean): number {
  const over = age - (esPortero ? 36 : 33);
  if (over <= 0) return 0;
  return Math.min(1, over * 0.22);
}

/** Apply one season of drift to a single (non-null) attribute value. */
function driftValue(value: number, trend: number, ceiling: number | null, rng: Rng): number {
  const jitter = rng.next01() * 2 - 1; // [-1, 1)
  let next = clampRating(value + trend + jitter);
  // Never grow past a known potential ceiling (potential drives youth growth later).
  if (ceiling !== null && next > value) next = Math.min(next, ceiling);
  return next;
}

/**
 * Evolve one player by a single season. Retirement is decided first; a retiring
 * player is returned unchanged with `retired: true` for the caller to remove.
 */
export function developPlayer(player: Player, ctx: DevelopmentContext): DevelopmentResult {
  const rng = createRng(hashSeed(ctx.seed, 'dev', ctx.seasonNumber, player.id));
  const age = playerAge(player, ctx.seasonStartYear);

  // Unknown age: hold steady (no evolution, no retirement).
  if (age === null) return { player, retired: false, age: null };

  if (rng.next01() < retirementChance(age, player.esPortero)) {
    return { player, retired: true, age };
  }

  const trend = ageTrend(age);
  const factor = player.esPortero ? GK_TREND_FACTOR : 1;
  const before = { ...player.atributos };

  const next: Attributes = { ...player.atributos };
  // Fixed attribute order for stable RNG consumption within this player.
  for (const key of PHYSICAL) {
    const value = before[key];
    if (value === null) continue; // physical attrs are never null; guard for the type
    const ceil = player.potencial ? player.potencial[key] : null;
    next[key] = driftValue(value, trend.phys * factor, ceil, rng);
  }
  for (const key of TECHNICAL) {
    const value = before[key];
    if (value === null) continue; // technical attrs are never null; guard for the type
    const ceil = player.potencial ? player.potencial[key] : null;
    next[key] = driftValue(value, trend.tech * factor, ceil, rng);
  }
  if (before.calidad !== null) {
    const ceil = player.potencial ? player.potencial.calidad : null;
    next.calidad = driftValue(before.calidad, trend.tech * factor, ceil, rng);
  }

  // Move media by the SAME delta the position-weighted core moved (never absolute).
  const coreDelta = coreMean(next, player.posicion) - coreMean(before, player.posicion);
  const media = Math.max(1, Math.min(99, Math.round(player.media + coreDelta)));

  return { player: { ...player, atributos: next, media }, retired: false, age };
}

export interface SquadDevelopment {
  /** Surviving players (evolved), sorted by id for determinism. */
  players: Player[];
  /** Players who retired this season. */
  retired: Player[];
}

/**
 * Evolve a whole squad by one season. Per-player seeding makes the result
 * independent of order; output arrays are sorted by id for stable snapshots.
 */
export function developSquad(players: Player[], ctx: DevelopmentContext): SquadDevelopment {
  const survivors: Player[] = [];
  const retired: Player[] = [];
  const ordered = [...players].sort((a, b) => a.id.localeCompare(b.id));
  for (const player of ordered) {
    const result = developPlayer(player, ctx);
    if (result.retired) retired.push(result.player);
    else survivors.push(result.player);
  }
  return { players: survivors, retired };
}
