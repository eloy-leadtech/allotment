import { create } from 'zustand';
import { SEASONS, getSeason, type League } from '@data';
import { newSeason, advanceMatchday, serializeSeason, restoreSeason, type SeasonState } from '@game';
import type { MatchResult } from '@engine';
import type { Screen } from '@app/navigation';
import { listSlots, readSlot, writeSlot, deleteSlot, type SlotInfo } from '@ui/persistence/saveSlots';

/** A fresh 32-bit seed from the browser CSPRNG (kept in /ui, not the engine). */
function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

interface GameStore {
  screen: Screen;
  /** Season chosen for the next new game. */
  seasonId: string;
  /** Seed chosen for the next new game (deterministic once fixed). */
  seed: number;
  /** League loaded for the chosen season (drives team select). */
  league: League;
  season: SeasonState | null;
  /** Results of the most recently played matchday (for the season screen list). */
  lastResults: MatchResult[];
  viewingMatch: MatchResult | null;
  /** Snapshot of the save slots (for the slots screen). */
  slots: Array<SlotInfo | null>;
  goTo: (screen: Screen) => void;
  chooseSeason: (id: string) => void;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;
  startSeason: (teamId: string) => void;
  playNextMatchday: () => void;
  openMatch: (result: MatchResult) => void;
  refreshSlots: () => void;
  saveToSlot: (slot: number) => void;
  loadFromSlot: (slot: number) => void;
  deleteSlotAt: (slot: number) => void;
}

/**
 * The single bridge between the React UI and the pure game/engine layers. Every
 * action delegates to `@game`; components never run simulation logic themselves.
 */
export const useGameStore = create<GameStore>((set, get) => {
  const first = SEASONS[0];
  if (!first) {
    throw new Error('No seasons available');
  }
  return {
    screen: 'title',
    seasonId: first.id,
    seed: randomSeed(),
    league: first.load(),
    season: null,
    lastResults: [],
    viewingMatch: null,
    slots: listSlots(),
    goTo: (screen) => set({ screen }),
    chooseSeason: (id) => {
      const entry = getSeason(id);
      if (entry) set({ seasonId: id, league: entry.load() });
    },
    setSeed: (seed) => set({ seed }),
    randomizeSeed: () => set({ seed: randomSeed() }),
    startSeason: (teamId) => {
      const { league, seed } = get();
      const season = newSeason(league, teamId, seed);
      set({ season, lastResults: [], viewingMatch: null, screen: 'season' });
    },
    playNextMatchday: () => {
      const { season } = get();
      if (!season) return;
      const step = advanceMatchday(season);
      set({ season: step.state, lastResults: step.played });
    },
    openMatch: (result) => set({ viewingMatch: result, screen: 'match' }),
    refreshSlots: () => set({ slots: listSlots() }),
    saveToSlot: (slot) => {
      const { season } = get();
      if (!season) return;
      writeSlot(slot, serializeSeason(season), Date.now());
      set({ slots: listSlots() });
    },
    loadFromSlot: (slot) => {
      const info = readSlot(slot);
      if (!info) return;
      const entry = getSeason(info.save.leagueId);
      if (!entry) return;
      const league = entry.load();
      const season = restoreSeason(info.save, league);
      set({ season, seasonId: entry.id, league, lastResults: [], viewingMatch: null, screen: 'season' });
    },
    deleteSlotAt: (slot) => {
      deleteSlot(slot);
      set({ slots: listSlots() });
    },
  };
});
