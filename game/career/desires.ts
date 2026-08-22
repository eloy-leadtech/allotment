/**
 * OBJETIVOS / DESEOS INDIVIDUALES DE JUGADOR — each key player carries a wish that
 * is DERIVED, deterministically, from their situation this season:
 *
 *  - RENOVAR: a key player (a projected starter, or one of the best in the squad)
 *    whose deal is in its LAST year wants it renewed.
 *  - MINUTOS: a young promise (<= YOUTH_AGE) who is NOT a projected starter wants
 *    to play — "juega poco".
 *  - EUROPA: a crack (the squad's very best) at a club with only a modest board
 *    objective wants to fight for Europe/titles.
 *  - CONTENTO: nobody with a specific gripe; the default.
 *
 * The wish is a pure function of the season-start situation (contract term, age,
 * squad standing by media, board objective), so it never needs new persistence: it
 * is RE-DERIVED from the same career data on load, exactly like form/morale/fatigue
 * are re-derived by the season replay.
 *
 * Its effect hooks the EXISTING morale system (engine/match/morale): each matchday a
 * player whose wish is met gets a small morale bump, one whose wish is unmet a small
 * dent. The deltas are deliberately tiny (comparable to the press-conference nudges)
 * so the ~2.6 goals/game balance is never distorted.
 *
 * Determinism note: the wish KIND is derived from the season-start squad by MEDIA
 * (never from the manager's chosen XI), so changing tactics mid-season never changes
 * anyone's wish — only whether they actually get minutes, which the replay already
 * reproduces. A mid-season RENOVAR is the one decision that mutates a contract; the
 * store re-derives the wishes then so the live season and a fresh load agree going
 * forward (see gameStore.renewPlayer).
 *
 * Pure and framework-free: no React, no browser, no RNG.
 */
import {
  clampScore,
  outcomeOf,
  playerMorale,
  selectStartingXI,
  type CompetitionTeam,
  type MatchOutcome,
} from '@engine';
import type { Player } from '@data';
import type { Contract } from './contracts';
import type { ObjectiveType } from './board';
import { playerAge, seasonStartYear } from './development';

/** The wish a player carries this season (CONTENTO = no specific gripe). */
export type DesireKind = 'renovar' | 'minutos' | 'europa' | 'contento';

/** Oldest age still counted as a "young promise" for the MINUTOS wish. */
export const YOUTH_AGE = 21;
/** A non-starter within this media gap of the squad's best still counts as "key" for RENOVAR. */
const RENOVAR_MEDIA_GAP = 2;
/** Only the squad's standout(s), within this media gap of the best, are "cracks" for EUROPA. */
const CRACK_MEDIA_GAP = 1;

/** Per-matchday morale deltas — small, on the scale of the press-conference nudges. */
const MINUTOS_PLAYED = 2;
const MINUTOS_BENCHED = -3;
const RENOVAR_DRIFT = -1;
const EUROPA_WIN = 1;
const EUROPA_DRAW = -1;
const EUROPA_LOSS = -2;

/** The board objectives that read as a "modest" ambition (frustrates a crack). */
function isModestObjective(type: ObjectiveType): boolean {
  return type === 'mid-table' || type === 'avoid-relegation';
}

/** Ids of the squad's projected best XI, purely by media (a stable GK + top-10 outfield). */
function projectedStarterIds(players: readonly Player[]): Set<string> {
  if (players.length < 11) return new Set(players.map((p) => p.id));
  // Reuse the engine's deterministic picker over a minimal media/keeper view.
  const view = players.map((p) => ({
    id: p.id,
    esPortero: p.esPortero,
    media: p.media,
    // Fields the picker's type wants but never reads for selection.
    nombre: p.nombre,
    posicion: p.posicion,
    remate: 0,
    ofensivo: 0,
    pase: 0,
    entrada: 0,
    porteria: 0,
  }));
  return new Set(selectStartingXI(view).map((p) => p.id));
}

/** Per-player inputs the wish is derived from. */
export interface PlayerDesireContext {
  age: number | null;
  contract?: Contract;
  isStarter: boolean;
  modestClub: boolean;
  /** The highest media in the squad (defines who is a "crack"). */
  topMedia: number;
}

/**
 * The wish a single player carries, from their situation. Priority: a key player
 * whose deal expires wants to RENOVAR first; then a benched youngster wants
 * MINUTOS; then a standout at a modest club wants EUROPA; otherwise CONTENTO.
 */
export function derivePlayerDesire(player: Player, ctx: PlayerDesireContext): DesireKind {
  const yearsLeft = ctx.contract?.yearsLeft;
  const isKey = ctx.isStarter || player.media >= ctx.topMedia - RENOVAR_MEDIA_GAP;
  if (yearsLeft !== undefined && yearsLeft <= 1 && isKey) return 'renovar';
  if (ctx.age !== null && ctx.age <= YOUTH_AGE && !ctx.isStarter) return 'minutos';
  if (ctx.modestClub && player.media >= ctx.topMedia - CRACK_MEDIA_GAP) return 'europa';
  return 'contento';
}

/** The minimum career view needed to derive the human squad's wishes. */
export interface DesireContext {
  humanTeamId: string;
  teams: readonly { id: string; players: readonly Player[] }[];
  contracts: Readonly<Record<string, Contract>>;
  board: { objective: { type: ObjectiveType } };
  temporada: string;
}

/**
 * Derive the wish of every human player, keyed by player id. Pure and
 * deterministic over the season-start situation, so a fresh load re-derives the
 * exact same map. Empty when the human squad can't be found.
 */
export function deriveHumanDesires(ctx: DesireContext): Record<string, DesireKind> {
  const team = ctx.teams.find((t) => t.id === ctx.humanTeamId);
  if (!team) return {};
  const startYear = seasonStartYear(ctx.temporada);
  const starterIds = projectedStarterIds(team.players);
  const modestClub = isModestObjective(ctx.board.objective.type);
  const topMedia = team.players.reduce((max, p) => Math.max(max, p.media), 0);
  const out: Record<string, DesireKind> = {};
  for (const p of team.players) {
    out[p.id] = derivePlayerDesire(p, {
      age: playerAge(p, startYear),
      contract: ctx.contracts[p.id],
      isStarter: starterIds.has(p.id),
      modestClub,
      topMedia,
    });
  }
  return out;
}

/**
 * The morale delta a wish produces for one matchday, from whether the player
 * played and the human's result. Kept tiny; CONTENTO (and any unknown id) is zero.
 */
export function desireMoraleDelta(
  kind: DesireKind,
  played: boolean,
  outcome: MatchOutcome,
): number {
  switch (kind) {
    case 'minutos':
      return played ? MINUTOS_PLAYED : MINUTOS_BENCHED;
    case 'renovar':
      // A steady, mild discontent while the deal runs down unrenewed.
      return RENOVAR_DRIFT;
    case 'europa':
      // The crack is happy only when the modest club actually wins.
      return outcome === 'win' ? EUROPA_WIN : outcome === 'loss' ? EUROPA_LOSS : EUROPA_DRAW;
    default:
      return 0;
  }
}

/** The human's fielded XI for a matchday, by id — the same pick applyFormMorale uses. */
function fieldedXiIds(team: CompetitionTeam): Set<string> {
  const xi = team.tactics?.xi ?? selectStartingXI(team.players);
  return new Set(xi.map((p) => p.id));
}

/** What the human team did on the matchday just played — the input to the wish drift. */
export interface HumanMatchday {
  /** True when the human actually had a fixture this matchday. */
  played: boolean;
  outcome: MatchOutcome;
  /** Ids of the human players who were in the fielded XI. */
  playedIds: ReadonlySet<string>;
}

/** Read the human's matchday context off its just-played result (bye => not played). */
export function humanMatchdayContext(
  humanTeam: CompetitionTeam | undefined,
  humanGoals: number | undefined,
  rivalGoals: number | undefined,
): HumanMatchday {
  if (!humanTeam || humanGoals === undefined || rivalGoals === undefined) {
    return { played: false, outcome: 'draw', playedIds: new Set() };
  }
  return {
    played: true,
    outcome: outcomeOf(humanGoals, rivalGoals),
    playedIds: fieldedXiIds(humanTeam),
  };
}

/**
 * Apply the wish-driven morale drift of one matchday to the human team only. A
 * benched player wanting minutes dips, a playing one lifts; a renewal-seeker drifts
 * down; a crack rides the result. The chosen-XI snapshot is kept in lockstep so the
 * next match fields the adjusted values. No wishes (or no human fixture) is a no-op.
 */
export function applyDesireMorale(
  teams: readonly CompetitionTeam[],
  humanTeamId: string,
  desires: Readonly<Record<string, DesireKind>>,
  ctx: HumanMatchday,
): CompetitionTeam[] {
  if (!ctx.played) return [...teams];
  return teams.map((team) => {
    if (team.id !== humanTeamId) return team;
    const bump = (p: CompetitionTeam['players'][number]): CompetitionTeam['players'][number] => {
      const delta = desireMoraleDelta(desires[p.id] ?? 'contento', ctx.playedIds.has(p.id), ctx.outcome);
      return delta === 0 ? p : { ...p, morale: clampScore(playerMorale(p) + delta) };
    };
    const players = team.players.map(bump);
    if (team.tactics?.xi) {
      const byId = new Map(players.map((p) => [p.id, p]));
      const xi = team.tactics.xi.map((p) => byId.get(p.id) ?? bump(p));
      return { ...team, players, tactics: { ...team.tactics, xi } };
    }
    return { ...team, players };
  });
}

/** Display metadata for a wish: a retro glyph, a label, and a UI tone. */
export interface DesireInfo {
  icon: string;
  label: string;
  /** 'want' = an unmet request (amber), 'neutral' = content. */
  tone: 'want' | 'neutral';
}

/** The label/glyph/tone the UI shows for a wish. */
export function desireInfo(kind: DesireKind): DesireInfo {
  switch (kind) {
    case 'renovar':
      return { icon: '↻', label: 'Quiere renovar', tone: 'want' };
    case 'minutos':
      return { icon: '▶', label: 'Quiere minutos', tone: 'want' };
    case 'europa':
      return { icon: '★', label: 'Ambición europea', tone: 'want' };
    default:
      return { icon: '–', label: 'Contento', tone: 'neutral' };
  }
}
