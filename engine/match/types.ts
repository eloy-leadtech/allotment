export type Line = 'POR' | 'DEF' | 'MED' | 'DEL';

export type EventType = 'goal' | 'chance' | 'yellow' | 'secondYellow' | 'red';

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
}

export interface MatchTeam {
  id: string;
  nombre: string;
  players: MatchPlayer[];
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
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}
