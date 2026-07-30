import { create } from 'zustand';
import { loadPrimera9697, type League } from '@data';
import { newSeason, advanceMatchday, type SeasonState } from '@game';
import type { MatchResult } from '@engine';
import type { Screen } from '@app/navigation';

/** Fixed seed for now → deterministic playthrough. */
const LEAGUE_SEED = 1997;

interface GameStore {
  league: League;
  screen: Screen;
  season: SeasonState | null;
  /** Results of the most recently played matchday (for the season screen list). */
  lastResults: MatchResult[];
  viewingMatch: MatchResult | null;
  goTo: (screen: Screen) => void;
  startSeason: (teamId: string) => void;
  playNextMatchday: () => void;
  openMatch: (result: MatchResult) => void;
}

/**
 * The single bridge between the React UI and the pure game/engine layers. Every
 * action delegates to `@game`; components never run simulation logic themselves.
 */
export const useGameStore = create<GameStore>((set, get) => ({
  league: loadPrimera9697(),
  screen: 'title',
  season: null,
  lastResults: [],
  viewingMatch: null,
  goTo: (screen) => set({ screen }),
  startSeason: (teamId) => {
    const season = newSeason(get().league, teamId, LEAGUE_SEED);
    set({ season, lastResults: [], viewingMatch: null, screen: 'season' });
  },
  playNextMatchday: () => {
    const { season } = get();
    if (!season) return;
    const step = advanceMatchday(season);
    set({ season: step.state, lastResults: step.played });
  },
  openMatch: (result) => set({ viewingMatch: result, screen: 'match' }),
}));
