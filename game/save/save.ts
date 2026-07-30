import type { League } from '@data';
import { advanceMatchday, isSeasonOver, newSeason, type SeasonState } from '../season/season';

const SAVE_VERSION = 1;

/**
 * Minimal, deterministic save. Because results are a pure function of the seed,
 * we only persist the resume point; restoring replays the played matchdays.
 */
export interface SaveGame {
  version: number;
  leagueId: string;
  temporada: string;
  seed: number;
  humanTeamId: string;
  currentMatchday: number;
}

export function serializeSeason(state: SeasonState): SaveGame {
  return {
    version: SAVE_VERSION,
    leagueId: state.leagueId,
    temporada: state.temporada,
    seed: state.seed,
    humanTeamId: state.humanTeamId,
    currentMatchday: state.currentMatchday,
  };
}

export function restoreSeason(save: SaveGame, league: League): SeasonState {
  if (save.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${save.version}`);
  }
  if (save.leagueId !== league.id) {
    throw new Error(`Save is for league ${save.leagueId}, not ${league.id}`);
  }
  let state = newSeason(league, save.humanTeamId, save.seed);
  while (state.currentMatchday < save.currentMatchday && !isSeasonOver(state)) {
    state = advanceMatchday(state).state;
  }
  return state;
}
