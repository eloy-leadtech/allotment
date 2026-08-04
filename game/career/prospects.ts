/**
 * Ojeo de PROMESAS de rivales: a curated shortlist of the league's young talents
 * from OTHER clubs, whom you can FOLLOW ("seguir") season after season to sharpen a
 * fallible read on their hidden potential, and then SIGN through the transfer market.
 *
 * Pure and deterministic. It never invents new randomness: it reuses the shared
 * scouting model in `scouting.ts` faithfully —
 *  - `synthesizePotential` builds the hidden per-attribute ceiling a rival carries
 *    (real players ship without a stored `potencial`);
 *  - `potentialOverall` collapses that ceiling into the single 0-99 the shortlist is
 *    selected by (SELECTION uses the TRUTH; the DISPLAY stays fallible);
 *  - `scoutEstimate` turns the ceiling into the `[low,high]` band the screen shows,
 *    narrowing (not necessarily getting more accurate) the LONGER you follow.
 *
 * The narrowing is driven by TIME, not by clicking: the band tightens by how many
 * career seasons have passed since you started following the prospect
 * (`ProspectTracking.since`), so genuinely tracking a target for years pays off,
 * while a fresh follow is as blurry as never having watched him.
 */
import type { Player } from '@data';
import type { CareerState, CareerTeam, ProspectTracking } from './types';
import { playerAge, seasonStartYear } from './development';
import { synthesizePotential, potentialOverall, scoutEstimate, type ScoutRange } from './scouting';
import { buyPlayer, type TransferResult } from './market';

/**
 * A "promesa" is YOUNG: at most this age (in years) at the season's start. Older
 * players — however good — are established, not prospects, so they never appear.
 */
export const PROSPECT_MAX_AGE = 21;

/**
 * ...and PROMISING: their hidden potential overall must clear this bar. This uses
 * the TRUE ceiling (`potentialOverall`), so the shortlist is a genuine scout's read
 * on who is worth watching — even though every band the UI shows is fallible.
 */
export const MIN_PROSPECT_POTENTIAL = 70;

/** The hidden potential ceiling for a player: the stored one, else synthesized. */
function hiddenPotential(player: Player, seed: number) {
  return player.potencial ?? synthesizePotential(player, seed);
}

/** The prospect's true (hidden) potential overall, used only for SELECTION. */
function trueProspectPotential(player: Player, seed: number): number {
  return potentialOverall(hiddenPotential(player, seed), player.posicion);
}

/**
 * Whether a player qualifies as a league promesa: young enough AND promising
 * enough. Membership depends only on the player, their age and the seed — never on
 * the follow state or the fallible estimate — so the shortlist is STABLE: following
 * a prospect can never change who is (or isn't) on the list.
 */
export function isProspect(player: Player, age: number | null, seed: number): boolean {
  if (age === null || age > PROSPECT_MAX_AGE) return false;
  return trueProspectPotential(player, seed) >= MIN_PROSPECT_POTENTIAL;
}

/** The follow record for a prospect, or undefined if you are not following them. */
export function prospectTracking(career: CareerState, playerId: string): ProspectTracking | undefined {
  return career.prospectTracking[playerId];
}

/** Whether you are currently following (siguiendo) a prospect. */
export function isFollowingProspect(career: CareerState, playerId: string): boolean {
  return career.prospectTracking[playerId] !== undefined;
}

/**
 * How many completed career seasons you have been following a prospect (0 if not
 * followed, or in the very season you started). This is the `observedSeasons` fed
 * to `scoutEstimate`, so a longer follow yields a tighter band.
 */
export function prospectSeasonsObserved(career: CareerState, playerId: string): number {
  const rec = career.prospectTracking[playerId];
  if (!rec) return 0;
  return Math.max(0, career.seasonNumber - rec.since);
}

/** A scout's report on one rival promesa: the fallible band plus follow state. */
export interface ProspectReport {
  player: Player;
  clubId: string;
  /** Age at the season's start (always known — prospects require a birth date). */
  age: number;
  /** Whether you are currently following this prospect. */
  following: boolean;
  /** Completed seasons followed; drives how tight the band is. */
  seasonsObserved: number;
  /** Fallible POTENTIAL overall band (narrows with seasons followed). */
  potential: ScoutRange;
}

/** Build the fallible report for one rival prospect from the career's follow state. */
function reportFor(career: CareerState, player: Player, clubId: string, age: number): ProspectReport {
  const seasonsObserved = prospectSeasonsObserved(career, player.id);
  const potencial = hiddenPotential(player, career.seed);
  return {
    player,
    clubId,
    age,
    following: isFollowingProspect(career, player.id),
    seasonsObserved,
    potential: scoutEstimate(player, potencial, seasonsObserved, career.seed),
  };
}

/**
 * The league's promesas: every young, promising player from a RIVAL club, each with
 * your current fallible report. Ordered so the prospects you follow surface first,
 * then by the ESTIMATED (fallible) potential midpoint, then by id as a stable
 * tiebreak — the order reads off the estimate, never the hidden truth.
 */
export function leagueProspects(career: CareerState): ProspectReport[] {
  const startYear = seasonStartYear(career.temporada);
  const out: ProspectReport[] = [];
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    for (const player of team.players) {
      const age = playerAge(player, startYear);
      if (!isProspect(player, age, career.seed)) continue;
      out.push(reportFor(career, player, team.id, age as number));
    }
  }
  const mid = (r: ProspectReport): number => (r.potential.low + r.potential.high) / 2;
  return out.sort((a, b) => {
    if (a.following !== b.following) return a.following ? -1 : 1;
    const dm = mid(b) - mid(a);
    if (dm !== 0) return dm;
    return a.player.id.localeCompare(b.player.id);
  });
}

/** Which rival club (if any) currently owns a player id. */
function rivalOwner(career: CareerState, playerId: string): CareerTeam | undefined {
  return career.teams.find(
    (t) => t.id !== career.humanTeamId && t.players.some((p) => p.id === playerId),
  );
}

/** The outcome of following / unfollowing a prospect. */
export interface FollowResult {
  career: CareerState;
  ok: boolean;
  /**
   * - `propio`: the player is in your own squad (nothing to ojear — they are yours).
   * - `no-encontrado`: no rival club owns that player id.
   * - `no-promesa`: the player exists but is not a young promesa.
   * - `ya-seguido`: you are already following that prospect.
   * - `no-seguido`: you were not following that prospect (unfollow).
   */
  reason?: 'propio' | 'no-encontrado' | 'no-promesa' | 'ya-seguido' | 'no-seguido';
}

/**
 * SEGUIR a rival promesa: start tracking them from this season, so their band
 * narrows the longer you keep following. Soft-fails (ok:false) if the player is your
 * own, unknown, not a promesa, or already followed. Pure: returns a new career.
 */
export function followProspect(career: CareerState, playerId: string): FollowResult {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  if (human?.players.some((p) => p.id === playerId)) {
    return { career, ok: false, reason: 'propio' };
  }
  const owner = rivalOwner(career, playerId);
  if (!owner) return { career, ok: false, reason: 'no-encontrado' };
  const player = owner.players.find((p) => p.id === playerId)!;
  const age = playerAge(player, seasonStartYear(career.temporada));
  if (!isProspect(player, age, career.seed)) return { career, ok: false, reason: 'no-promesa' };
  if (career.prospectTracking[playerId]) return { career, ok: false, reason: 'ya-seguido' };

  const record: ProspectTracking = { since: career.seasonNumber };
  return {
    career: { ...career, prospectTracking: { ...career.prospectTracking, [playerId]: record } },
    ok: true,
  };
}

/**
 * DEJAR DE SEGUIR a prospect: stop tracking them (any accumulated sharpening is
 * lost — following is a live commitment). Soft-fails if you were not following them.
 */
export function unfollowProspect(career: CareerState, playerId: string): FollowResult {
  if (!career.prospectTracking[playerId]) return { career, ok: false, reason: 'no-seguido' };
  const tracking = { ...career.prospectTracking };
  delete tracking[playerId];
  return { career: { ...career, prospectTracking: tracking }, ok: true };
}

/** The outcome of signing a prospect through the market. */
export type SignProspectReason = TransferResult['reason'] | 'mercado-cerrado';
export interface SignProspectResult {
  career: CareerState;
  ok: boolean;
  reason?: SignProspectReason;
}

/**
 * FICHAR a followed promesa. This is the market hook: it delegates to `buyPlayer`
 * (market.ts) at the selling club's asking price, so a prospect is bought exactly
 * like any other rival — budget check, contract and roster move all included. On a
 * completed signing the follow record is dropped (the player is now yours, so there
 * is nothing left to ojear). The market is only open in the pre-season, so this
 * soft-fails with `mercado-cerrado` once a matchday has been played.
 */
export function signProspect(career: CareerState, playerId: string): SignProspectResult {
  // Guard the market window ourselves so `buyPlayer` never throws on a closed market.
  if (career.season.results.length > 0) return { career, ok: false, reason: 'mercado-cerrado' };
  const result = buyPlayer(career, playerId);
  if (!result.ok) return { career: result.career, ok: false, reason: result.reason };
  // The signing joined your squad; drop any follow record so it does not linger.
  if (result.career.prospectTracking[playerId]) {
    const tracking = { ...result.career.prospectTracking };
    delete tracking[playerId];
    return { career: { ...result.career, prospectTracking: tracking }, ok: true };
  }
  return { career: result.career, ok: true };
}
