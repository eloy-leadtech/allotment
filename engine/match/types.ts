export type Line = 'POR' | 'DEF' | 'MED' | 'DEL';

/**
 * Core event types drive the scoreline/discipline stream (goals, cards, injuries).
 * The `flavor` types below are purely narrative colour — they NEVER change the
 * result and are generated on an isolated RNG (see `simulateMatch`).
 */
export type EventType =
  | 'goal'
  | 'chance'
  | 'yellow'
  | 'secondYellow'
  | 'red'
  | 'injury'
  // Flavor-only events (teletipo variety, no effect on the score):
  | 'saved'
  | 'offTarget'
  | 'post'
  | 'corner'
  | 'foul';

/** The purely-narrative event types: they add teletipo colour, never goals/cards. */
export const FLAVOR_EVENT_TYPES = ['saved', 'offTarget', 'post', 'corner', 'foul'] as const;

export type FlavorEventType = (typeof FLAVOR_EVENT_TYPES)[number];

/** Whether an event type is flavor-only (does not affect the scoreline/discipline). */
export function isFlavorEvent(type: EventType): type is FlavorEventType {
  return (FLAVOR_EVENT_TYPES as readonly string[]).includes(type);
}

/** Minimal player view the match engine needs (mapped from the data Player). */
export interface MatchPlayer {
  id: string;
  nombre: string;
  posicion: Line;
  esPortero: boolean;
  media: number;
  remate: number;
  ofensivo: number;
  pase: number;
  entrada: number;
  porteria: number;
  /**
   * Short-term streak (0-100, 50 neutral): rises with wins/goals/playing, falls
   * with defeats and benching. Optional so existing fixtures stay valid; when
   * absent the player is treated as neutral (no effect on the pitch).
   */
  form?: number;
  /** Player morale (0-100, 50 neutral): medium-term, moved by results and minutes. */
  morale?: number;
  /**
   * Physical fatigue (0-100, 0 fresh): rises with minutes played, recovers with
   * rest. Optional so existing fixtures stay valid; absent means fresh (no effect
   * on the pitch). Feeds a small penalty multiplier into the effective ratings.
   */
  fatigue?: number;
}

/** Playable formations (defenders-midfielders-forwards). */
export type Formation = '5-4-1' | '5-3-2' | '4-5-1' | '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3';

/** A team's tactical setup for a match. */
export interface Tactics {
  formation: Formation;
  /** Explicit starting XI; when absent the best XI is auto-selected. */
  xi?: MatchPlayer[];
}

export interface MatchTeam {
  id: string;
  nombre: string;
  players: MatchPlayer[];
  /** Optional tactics; when absent the team plays a neutral auto-selected XI. */
  tactics?: Tactics;
}

export interface MatchInput {
  home: MatchTeam;
  away: MatchTeam;
  /** Deterministic seed; the same seed always replays the same match. */
  seed: number;
}

/** A single match event; the one source that feeds both teletipo and (later) the 2D viewer. */
export interface MatchEvent {
  min: number;
  type: EventType;
  team: 'home' | 'away';
  playerId: string;
  playerName: string;
  /**
   * For `injury` events: how many upcoming matchdays the player is out (1-8).
   * Absent for every other event type.
   */
  matchesOut?: number;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}
