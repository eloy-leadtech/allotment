import type { Player, TeamColors } from '@data';
import type { SeasonState } from '../season/season';
import type { Division } from './promotion';

/** A team as it lives across a career: full player data that evolves season to season. */
export interface CareerTeam {
  id: string;
  nombre: string;
  colores?: TeamColors;
  players: Player[];
}

/** One line of the career palmarés/history. Grows with retirements/transfers later. */
export interface SeasonSummary {
  seasonNumber: number;
  temporada: string;
  championId: string;
}

/**
 * The whole career: owner of the evolving full-data teams. The in-progress
 * `season` is DERIVED from `teams`; the teams are the source of truth.
 */
export interface CareerState {
  seed: number;
  leagueId: string;
  humanTeamId: string;
  /** 1-indexed career season. */
  seasonNumber: number;
  /** Season label, e.g. "96/97". */
  temporada: string;
  pointsForWin: 2 | 3;
  relegationSpots: number;
  /** Which division the human currently competes in. */
  division: Division;
  /** The human club's transfer budget, in whole euros. */
  budget: number;
  teams: CareerTeam[];
  season: SeasonState;
  history: SeasonSummary[];
}
