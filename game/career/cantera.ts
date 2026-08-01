/**
 * Cantera / juveniles: your club's youth academy. Pure and deterministic — every
 * prospect (name, position, age, low attributes and HIDDEN potential ceiling) is
 * derived from `hashSeed(seed, ...)`, never from `Math.random`/`Date.now`, so the
 * same seed + season + club always breeds the same hornada on every machine.
 *
 * The pipeline reuses the scouting model faithfully:
 *  - `synthesizePotential` (from scouting.ts) invents the per-attribute ceiling
 *    that the aging curve in development.ts honours once the youth is promoted.
 *  - `potentialOverall` collapses the CURRENT attributes into the youth's `media`
 *    (always <= its potential, since every ceiling is >= its current value).
 *  - `scoutEstimate` gives the fallible [low, high] range the UI shows, narrowing
 *    (not necessarily getting more accurate) the longer the prospect is watched.
 */
import { createRng, hashSeed, type Rng } from '@engine';
import type { Attributes, Player, Position } from '@data';
import type { CareerState, YouthProspect } from './types';
import { synthesizePotential, potentialOverall, scoutEstimate, type ScoutRange } from './scouting';
import { seasonStartYear } from './development';
import { toMatchPlayer } from '../season/season';

/** How many juveniles enter the academy each pretemporada (inclusive range). */
export const YOUTH_BATCH_MIN = 2;
export const YOUTH_BATCH_MAX = 4;

/**
 * A prospect not promoted within this many seasons leaves the club ("no cuajó").
 * With a value of 2 a youth stays for its entry season plus one more, then goes.
 */
export const YOUTH_MAX_SEASONS_IN_ACADEMY = 2;

/** Youngest / oldest age a fresh juvenile can be at the season start. */
const YOUTH_MIN_AGE = 16;
const YOUTH_MAX_AGE = 18;

const clampRating = (v: number): number => Math.max(0, Math.min(99, Math.round(v)));

/**
 * Spanish first names and surnames for home-grown canteranos. Small pools kept
 * inline so generation stays a pure, dependency-free function.
 */
const FIRST_NAMES: readonly string[] = [
  'Álvaro', 'Sergio', 'Javier', 'Carlos', 'David', 'Raúl', 'Iván', 'Rubén',
  'Pablo', 'Adrián', 'Marcos', 'Diego', 'Fernando', 'Jorge', 'Óscar', 'Rafael',
  'Manuel', 'Antonio', 'Juan', 'Miguel', 'Ángel', 'Víctor', 'Alberto', 'Gonzalo',
  'Iker', 'Nacho', 'Guti', 'Aitor', 'Unai', 'Borja', 'Isco', 'Koke',
];

const SURNAMES: readonly string[] = [
  'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez',
  'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno',
  'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres',
  'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Castro',
];

/** Pick a value from a pool deterministically. */
function pick<T>(pool: readonly T[], rng: Rng): T {
  return pool[rng.int(pool.length)] as T;
}

/** Position mix for a youth intake: keepers are rarer than outfield lines. */
function drawPosition(rng: Rng): Position {
  const roll = rng.int(100);
  if (roll < 12) return 'POR';
  if (roll < 42) return 'DEF';
  if (roll < 74) return 'MED';
  return 'DEL';
}

/** Two-digit zero-padded number for building an ISO birth date. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Build one prospect's LOW current attributes. `base` sets the overall level
 * (more talented youths start a touch higher). Goalkeepers get a real `porteria`
 * and muted attacking skills; outfielders get a low `porteria`. RNG is consumed
 * in a fixed order so the draw is reproducible.
 */
function youthAttributes(pos: Position, base: number, rng: Rng): Attributes {
  const draw = (): number => clampRating(base - 3 + rng.int(9)); // base-3 .. base+5
  const attrs: Attributes = {
    calidad: draw(),
    agresividad: draw(),
    resistencia: draw(),
    velocidad: draw(),
    fisico: draw(),
    remate: draw(),
    ofensivo: draw(),
    pase: draw(),
    entrada: draw(),
    porteria: pos === 'POR' ? clampRating(base + 8 + rng.int(8)) : clampRating(4 + rng.int(10)),
  };
  if (pos === 'POR') {
    attrs.remate = clampRating(6 + rng.int(10));
    attrs.ofensivo = clampRating(6 + rng.int(10));
  }
  return attrs;
}

/** Everything needed to breed a deterministic hornada. */
export interface YouthGenParams {
  seed: number;
  /** Career season the hornada enters (1-indexed). */
  seasonNumber: number;
  /** Season label, e.g. "96/97", used to compute the youths' birth years. */
  temporada: string;
  humanTeamId: string;
}

/** Breed a single prospect, index `i` within its hornada. */
function makeProspect(params: YouthGenParams, startYear: number, i: number): YouthProspect {
  const rng = createRng(hashSeed(params.seed, 'youth', params.humanTeamId, params.seasonNumber, i));

  const talent = rng.next01(); // hidden promise in [0,1)
  const base = 26 + Math.round(talent * 18); // current level 26..44 (low)
  const promiseMedia = clampRating(55 + Math.round(talent * 40)); // ceiling driver 55..95

  const age = YOUTH_MIN_AGE + rng.int(YOUTH_MAX_AGE - YOUTH_MIN_AGE + 1);
  const birthYear = startYear - age;
  const month = 1 + rng.int(12);
  const day = 1 + rng.int(28);

  const pos = drawPosition(rng);
  const nombre = pick(FIRST_NAMES, rng);
  const nombreCompleto = `${nombre} ${pick(SURNAMES, rng)} ${pick(SURNAMES, rng)}`;

  const atributos = youthAttributes(pos, base, rng);
  const id = `cantera-${params.humanTeamId}-${params.seasonNumber}-${i}`;

  // The potential ceiling: feed synthesizePotential a promise-weighted player so
  // headroom scales with the hidden talent (not with the low current media).
  const promisePlayer: Player = {
    id,
    nombre,
    nombreCompleto,
    posicion: pos,
    esPortero: pos === 'POR',
    demarcaciones: [],
    atributos: { ...atributos, calidad: promiseMedia },
    media: promiseMedia,
    dorsal: null,
    fechaNacimiento: `${birthYear}-${pad2(month)}-${pad2(day)}`,
    alturaCm: null,
    pesoKg: null,
    nacionalidad: 'ES',
    clubAnterior: null,
  };
  const potencial = synthesizePotential(promisePlayer, params.seed);
  const media = potentialOverall(atributos, pos);

  const player: Player = { ...promisePlayer, atributos, media, potencial };
  return { player, entrySeason: params.seasonNumber };
}

/**
 * Breed the pretemporada hornada: `YOUTH_BATCH_MIN`..`YOUTH_BATCH_MAX` juveniles,
 * deterministic by seed + season + club.
 */
export function generateYouthBatch(params: YouthGenParams): YouthProspect[] {
  const rng = createRng(hashSeed(params.seed, 'youth-batch', params.humanTeamId, params.seasonNumber));
  const count = YOUTH_BATCH_MIN + rng.int(YOUTH_BATCH_MAX - YOUTH_BATCH_MIN + 1);
  const startYear = seasonStartYear(params.temporada);
  const out: YouthProspect[] = [];
  for (let i = 0; i < count; i += 1) out.push(makeProspect(params, startYear, i));
  return out;
}

/**
 * Roll the academy forward one season: prospects who overstayed leave ("no
 * cuajaron"), then a fresh hornada joins. Pure; ids stay unique because each
 * hornada keys on its own `seasonNumber`.
 */
export function rolloverYouth(previous: YouthProspect[], params: YouthGenParams): YouthProspect[] {
  const kept = previous.filter((p) => params.seasonNumber - p.entrySeason < YOUTH_MAX_SEASONS_IN_ACADEMY);
  return [...kept, ...generateYouthBatch(params)];
}

/** How many seasons the scout has watched a prospect (0 the season it entered). */
export function prospectObservedSeasons(prospect: YouthProspect, currentSeasonNumber: number): number {
  return Math.max(0, currentSeasonNumber - prospect.entrySeason);
}

/**
 * The scout's fallible potential range for a prospect. Uses the stored ceiling
 * (`player.potencial`) and the observation count so the band narrows over time.
 */
export function prospectScoutRange(prospect: YouthProspect, seed: number, currentSeasonNumber: number): ScoutRange {
  const potencial = prospect.player.potencial ?? synthesizePotential(prospect.player, seed);
  return scoutEstimate(prospect.player, potencial, prospectObservedSeasons(prospect, currentSeasonNumber), seed);
}

/**
 * PROMOTE a prospect to the first team: it joins your squad (source of truth) and
 * the in-progress season's competition team, WITHOUT resetting played matchdays —
 * it simply becomes selectable from the next matchday. No-op for an unknown id.
 */
export function promoteProspect(career: CareerState, prospectId: string): CareerState {
  const prospect = career.youthProspects.find((p) => p.player.id === prospectId);
  if (!prospect) return career;

  const teams = career.teams.map((t) =>
    t.id === career.humanTeamId ? { ...t, players: [...t.players, prospect.player] } : t,
  );
  const matchPlayer = toMatchPlayer(prospect.player);
  const seasonTeams = career.season.teams.map((t) =>
    t.id === career.humanTeamId ? { ...t, players: [...t.players, matchPlayer] } : t,
  );
  return {
    ...career,
    teams,
    youthProspects: career.youthProspects.filter((p) => p.player.id !== prospectId),
    season: { ...career.season, teams: seasonTeams },
  };
}

/** DISCARD a prospect: it leaves the academy for good. No-op for an unknown id. */
export function discardProspect(career: CareerState, prospectId: string): CareerState {
  return {
    ...career,
    youthProspects: career.youthProspects.filter((p) => p.player.id !== prospectId),
  };
}
