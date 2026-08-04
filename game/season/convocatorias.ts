/**
 * Convocatorias de selección + fatiga internacional — the PC Fútbol
 * international-break mechanic.
 *
 * A couple of fixed matchdays a season are "parones": your best players are
 * called up by their national teams and come back with EXTRA fatigue, so the
 * league game right after the break finds them a touch jaded. This layers on top
 * of the existing wear mechanic (engine/match/fatigue) — it only ever pushes a
 * player's fatigue UP, never resets or replaces it — so a squad that isn't
 * called up behaves exactly as before.
 *
 * Faithful-but-pragmatic: rather than reshaping the round-robin calendar to
 * insert blank weeks (which would ripple through standings and every test), the
 * break is modelled as extra fatigue applied on top of the regular league
 * matchday that coincides with the parón. The convocados carry it into the
 * following jornada.
 *
 * Pure and deterministic (no wall-clock RNG): who is an international is a
 * function of the season seed and the player, and the break effect is applied
 * inside `advanceMatchday`. Like fatigue itself, NOTHING is persisted — replaying
 * a season from its fresh start always reconstructs identical call-ups and
 * fatigue, so the save stays small and no new migration surface is added.
 */
import {
  clampFatigue,
  createRng,
  hashSeed,
  playerFatigue,
  type CompetitionTeam,
  type MatchPlayer,
} from '@engine';

/**
 * Below this media a player is never a current international. Internationals are
 * the squad's better players; the sparse `nacionalidad` field is only a mild
 * extra signal on top (see `callUpProbability`).
 */
export const INTERNATIONAL_MEDIA_FLOOR = 78;

/** Media at which the call-up probability saturates near its ceiling. */
const INTERNATIONAL_MEDIA_CEIL = 92;

/** Call-up probability at the media floor, ramping up to `PROB_CEIL` at the ceiling. */
const PROB_FLOOR = 0.15;
const PROB_CEIL = 0.9;

/** Mild boost when the player carries a known nationality (a real, if weak, signal). */
const NATIONALITY_BONUS = 0.1;

/**
 * Extra fatigue a called-up player brings back from the international break, added
 * on top of the regular matchday's fatigue and clamped to the [0,100] range. Sized
 * so a fresh convocado returns visibly tired (>= one condition tier).
 */
export const INTERNATIONAL_BREAK_FATIGUE = 25;

/** The minimal player view the call-up decision needs (a subset of MatchPlayer). */
type CallUpCandidate = Pick<MatchPlayer, 'id' | 'media' | 'nacionalidad'>;

/** True when the player carries a usable (non-empty) nationality signal. */
function hasNationalitySignal(nacionalidad?: string): boolean {
  return typeof nacionalidad === 'string' && nacionalidad.trim().length > 0;
}

/**
 * The deterministic probability that a player of this media (and nationality
 * signal) is a current international. Zero below the media floor; otherwise ramps
 * linearly from `PROB_FLOOR` up to `PROB_CEIL`, nudged by the nationality bonus.
 */
export function callUpProbability(media: number, hasNationality: boolean): number {
  if (media < INTERNATIONAL_MEDIA_FLOOR) return 0;
  const span = INTERNATIONAL_MEDIA_CEIL - INTERNATIONAL_MEDIA_FLOOR;
  const t = Math.min(1, Math.max(0, (media - INTERNATIONAL_MEDIA_FLOOR) / span));
  const p = PROB_FLOOR + t * (PROB_CEIL - PROB_FLOOR);
  return Math.min(1, p + (hasNationality ? NATIONALITY_BONUS : 0));
}

/**
 * Is this player a called-up international for the given season seed? Deterministic
 * per (seed, player id): media drives the odds, a known nationality nudges them,
 * and a seeded hash picks the realistic subset (so not every good player goes).
 */
export function isInternational(player: CallUpCandidate, seed: number): boolean {
  const p = callUpProbability(player.media, hasNationalitySignal(player.nacionalidad));
  if (p <= 0) return false;
  if (p >= 1) return true;
  const rng = createRng(hashSeed(seed, 'convocatoria', player.id));
  return rng.next01() < p;
}

/** The called-up internationals within a squad, for a given season seed. */
export function calledUpPlayers(
  players: readonly MatchPlayer[],
  seed: number,
): MatchPlayer[] {
  return players.filter((p) => isInternational(p, seed));
}

/**
 * The 1-indexed league matchdays that coincide with a national-team parón. One or
 * two per season (roughly at the thirds), fixed and deterministic from the season
 * length. Very short seasons (fewer than 6 matchdays) get none.
 */
export function paronMatchdays(totalMatchdays: number): number[] {
  if (totalMatchdays < 6) return [];
  const first = Math.max(1, Math.round(totalMatchdays / 3));
  const second = Math.min(totalMatchdays, Math.max(first + 1, Math.round((2 * totalMatchdays) / 3)));
  return second > first ? [first, second] : [first];
}

/** Whether the given matchday is a parón (international break) matchday. */
export function isParonMatchday(matchday: number, totalMatchdays: number): boolean {
  return paronMatchdays(totalMatchdays).includes(matchday);
}

/** One called-up player in a break notice, with the fatigue the break added. */
export interface CallUp {
  id: string;
  nombre: string;
  media: number;
  /** Fatigue before the international break was applied. */
  fatigueBefore: number;
  /** Fatigue after the international break was applied (>= fatigueBefore). */
  fatigueAfter: number;
}

/** The user-facing notice for an international break the human club lived through. */
export interface CallUpNotice {
  /** The 1-indexed matchday the break coincided with. */
  matchday: number;
  /** The human club's called-up players and the extra fatigue they returned with. */
  players: CallUp[];
}

/**
 * Add the international-break fatigue to a squad's called-up internationals,
 * leaving everyone else untouched. Mirrors `applyFatigue`'s tactics.xi sync so a
 * team with an explicit XI keeps its snapshot current for the next match.
 */
function applyBreakToTeam(team: CompetitionTeam, seed: number): CompetitionTeam {
  const calledUp = new Set(calledUpPlayers(team.players, seed).map((p) => p.id));
  if (calledUp.size === 0) return team;
  const players = team.players.map((p) =>
    calledUp.has(p.id)
      ? { ...p, fatigue: clampFatigue(playerFatigue(p) + INTERNATIONAL_BREAK_FATIGUE) }
      : p,
  );
  if (team.tactics?.xi) {
    const byId = new Map(players.map((p) => [p.id, p]));
    const xi = team.tactics.xi.map((p) => byId.get(p.id) ?? p);
    return { ...team, players, tactics: { ...team.tactics, xi } };
  }
  return { ...team, players };
}

/** Options driving one international break (the season context it needs). */
export interface InternationalBreakContext {
  matchday: number;
  seed: number;
  totalMatchdays: number;
  humanTeamId: string;
}

/**
 * Apply an international break for the matchday just played. On a non-parón
 * matchday this is a no-op (teams returned as-is, no notice). On a parón matchday
 * every club's internationals gain the break fatigue (symmetrically, so the
 * scoreline balance the fatigue mechanic guards is preserved) and a notice is
 * produced for the human club — but only when the human actually had someone
 * called up.
 */
export function applyInternationalBreak(
  teams: readonly CompetitionTeam[],
  ctx: InternationalBreakContext,
): { teams: CompetitionTeam[]; notice: CallUpNotice | null } {
  if (!isParonMatchday(ctx.matchday, ctx.totalMatchdays)) {
    return { teams: [...teams], notice: null };
  }
  const humanBefore = teams.find((t) => t.id === ctx.humanTeamId);
  const beforeById = new Map((humanBefore?.players ?? []).map((p) => [p.id, playerFatigue(p)]));

  const updated = teams.map((team) => applyBreakToTeam(team, ctx.seed));

  const humanAfter = updated.find((t) => t.id === ctx.humanTeamId);
  const calledUp = humanAfter ? calledUpPlayers(humanAfter.players, ctx.seed) : [];
  const notice: CallUpNotice | null =
    calledUp.length > 0
      ? {
          matchday: ctx.matchday,
          players: calledUp.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            media: p.media,
            fatigueBefore: beforeById.get(p.id) ?? 0,
            fatigueAfter: playerFatigue(p),
          })),
        }
      : null;

  return { teams: updated, notice };
}
