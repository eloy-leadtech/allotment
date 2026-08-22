/**
 * Ojeo de rivales / informes de ojeador: scout players from OTHER clubs (not just
 * your cantera). Pure and deterministic — every estimate is derived from a seed
 * via `hashSeed`, never from `Math.random`/`Date.now`, so the same player + seed +
 * observation count always yields the same report on every machine.
 *
 * It reuses the scouting model faithfully:
 *  - `synthesizePotential` (scouting.ts) invents the hidden per-attribute ceiling
 *    for a rival (real players carry no stored `potencial`).
 *  - `scoutEstimate` (scouting.ts) turns that ceiling into the fallible [low,high]
 *    POTENTIAL band the report shows, narrowing (not necessarily getting more
 *    accurate) the more the player is observed.
 *  - `abilityEstimate` (here) mirrors that idea for CURRENT ability (media): a
 *    band that hides the exact media until you have ojeado the player enough.
 *
 * The scouting count is bounded by TIME, not by clicking: a player can be assigned
 * a scout at most once per career season (`observePlayer` no-ops otherwise), so the
 * band genuinely narrows season over season as you keep watching a target.
 */
import { createRng, hashSeed } from '@engine';
import type { Player } from '@data';
import type { CareerState, CareerTeam, ScoutingRecord } from './types';
import { synthesizePotential, scoutEstimate, scoutPrecisionFactor, type ScoutRange } from './scouting';
import { scoutPrecisionLevel } from './staff';

/** Clamp to the classic 0-99 rating scale (integer). */
const clampRating = (v: number): number => Math.max(0, Math.min(99, Math.round(v)));

/**
 * Observations needed before the scout is confident enough to REVEAL the player's
 * exact current media. Below it the market only shows the estimated ability band.
 */
export const REVEAL_THRESHOLD = 3;

/** Widest half-width of the current-ability band (at zero observations). */
const ABILITY_HALF_BASE = 12;
/** How fast the ability band narrows per observation. */
const ABILITY_NARROW_RATE = 0.6;
/** Largest stable per-player over/under-read the scout carries on current ability. */
const ABILITY_MAX_BIAS = 8;

/**
 * A fallible scout's estimate of a player's CURRENT ability (`player.media`).
 *
 * Same shape as `scoutEstimate` but centred on the current media instead of the
 * potential overall: a STABLE per-player bias (seeded without `observations`, so
 * it never washes out) plus a half-width that shrinks as `observations` grows.
 * The band can therefore sit off the true media and look more confident as it
 * narrows. Deterministic via `hashSeed(seed, 'ojeo-ability', player.id, ...)`.
 */
export function abilityEstimate(
  player: Player,
  observations: number,
  seed: number,
  scoutLevel = 0,
): ScoutRange {
  const truth = player.media;
  // A hired ojeador tightens the band and shrinks the bias (1 = no ojeador).
  const precision = scoutPrecisionFactor(scoutLevel);

  const biasRng = createRng(hashSeed(seed, 'ojeo-ability', player.id));
  const biasSign = biasRng.next01() < 0.5 ? -1 : 1;
  const biasMag = biasRng.next01() * ABILITY_MAX_BIAS;
  const bias = biasSign * biasMag * precision;

  const noiseRng = createRng(hashSeed(seed, 'ojeo-ability', player.id, observations));
  const half = (ABILITY_HALF_BASE / (1 + observations * ABILITY_NARROW_RATE)) * precision;
  const jitter = (noiseRng.next01() * 2 - 1) * half * 0.4;

  const center = truth + bias + jitter;
  const a = clampRating(center - half);
  const b = clampRating(center + half);
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

/** The scouting record for a player, or undefined if never ojeado. */
export function scoutingRecord(career: CareerState, playerId: string): ScoutingRecord | undefined {
  return career.scouting[playerId];
}

/** How many times the human has ojeado a player (0 if never). */
export function scoutingObservations(career: CareerState, playerId: string): number {
  return career.scouting[playerId]?.observations ?? 0;
}

/** A scout's full report on a rival player: fallible bands plus reveal state. */
export interface ScoutReport {
  /** How many times this player has been ojeado (accumulates across seasons). */
  observations: number;
  /** Whether a scout was already assigned to this player THIS season. */
  scoutedThisSeason: boolean;
  /** Estimated POTENTIAL overall band (fallible; narrows with observation). */
  potential: ScoutRange;
  /** Estimated CURRENT ability band (fallible; narrows with observation). */
  ability: ScoutRange;
  /** True once `observations >= REVEAL_THRESHOLD`: the exact media is known. */
  revealed: boolean;
  /** The exact current media, ONLY once `revealed`; null while still hidden. */
  media: number | null;
}

/**
 * Build the fallible scouting report for a rival player from the career's stored
 * observation count. Reuses the shared potential ceiling (`player.potencial` when
 * present, else `synthesizePotential`) so a rival's potential band is consistent
 * with the rest of the game. The exact media stays hidden until `REVEAL_THRESHOLD`.
 */
export function playerScoutReport(career: CareerState, player: Player): ScoutReport {
  const rec = career.scouting[player.id];
  const observations = rec?.observations ?? 0;
  const scoutedThisSeason = (rec?.lastSeason ?? 0) >= career.seasonNumber;
  const potencial = player.potencial ?? synthesizePotential(player, career.seed);
  // A hired ojeador makes both bands (potential + current ability) more precise.
  const scoutLevel = scoutPrecisionLevel(career.staff);
  const potential = scoutEstimate(player, potencial, observations, career.seed, scoutLevel);
  const ability = abilityEstimate(player, observations, career.seed, scoutLevel);
  const revealed = observations >= REVEAL_THRESHOLD;
  return {
    observations,
    scoutedThisSeason,
    potential,
    ability,
    revealed,
    media: revealed ? player.media : null,
  };
}

/** The outcome of assigning a scout to a player. */
export interface ObserveResult {
  career: CareerState;
  ok: boolean;
  /**
   * - `propio`: the player is in your own squad (nothing to ojear — you know them).
   * - `no-encontrado`: no rival club owns that player id.
   * - `ya-ojeado`: you already assigned a scout to them THIS season.
   */
  reason?: 'propio' | 'no-encontrado' | 'ya-ojeado';
}

/** Which rival club (if any) currently owns a player id. */
function rivalOwner(career: CareerState, playerId: string): CareerTeam | undefined {
  return career.teams.find(
    (t) => t.id !== career.humanTeamId && t.players.some((p) => p.id === playerId),
  );
}

/**
 * OJEAR a rival player: assign a scout, deepening the report by one observation.
 * Soft-fails (ok:false) if the player is your own, unknown, or already ojeado this
 * season. Pure: returns a new career, never mutates. The observation count
 * accumulates across seasons, so following a target for years tightens its band.
 */
export function observePlayer(career: CareerState, playerId: string): ObserveResult {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  if (human?.players.some((p) => p.id === playerId)) {
    return { career, ok: false, reason: 'propio' };
  }
  const owner = rivalOwner(career, playerId);
  if (!owner) return { career, ok: false, reason: 'no-encontrado' };

  const prev = career.scouting[playerId];
  if ((prev?.lastSeason ?? 0) >= career.seasonNumber) {
    return { career, ok: false, reason: 'ya-ojeado' };
  }
  const record: ScoutingRecord = {
    observations: (prev?.observations ?? 0) + 1,
    lastSeason: career.seasonNumber,
  };
  return {
    career: { ...career, scouting: { ...career.scouting, [playerId]: record } },
    ok: true,
  };
}

/** A rival player you can ojear, paired with your current report on them. */
export interface ScoutTarget {
  player: Player;
  clubId: string;
  report: ScoutReport;
}

/**
 * Every rival player you could ojear, each with your current report. Ordered so
 * the players you have already scouted (most-observed first) surface to the top,
 * then the rest alphabetically — the ordering never leaks a player's hidden media.
 */
export function scoutTargets(career: CareerState): ScoutTarget[] {
  const out: ScoutTarget[] = [];
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    for (const player of team.players) {
      out.push({ player, clubId: team.id, report: playerScoutReport(career, player) });
    }
  }
  return out.sort((a, b) => {
    if (a.report.observations !== b.report.observations) {
      return b.report.observations - a.report.observations;
    }
    return a.player.nombre.localeCompare(b.player.nombre);
  });
}
