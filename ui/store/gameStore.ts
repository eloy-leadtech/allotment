import { create } from 'zustand';
import { SEASONS, getSeason, type League, type SeasonEntry } from '@data';
import {
  newCareer,
  applyTransition,
  advanceMatchday,
  serializeCareer,
  restoreCareer,
  type CareerState,
  type SeasonState,
} from '@game';
import type { MatchResult } from '@engine';
import type { Screen } from '@app/navigation';
import { listSlots, readSlot, writeSlot, deleteSlot, type SlotInfo } from '@ui/persistence/saveSlots';

/** A fresh 32-bit seed from the browser CSPRNG (kept in /ui, not the engine). */
function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

/** The next real season after a given league id, or null if there is none yet. */
export function nextSeasonEntry(leagueId: string): SeasonEntry | null {
  const idx = SEASONS.findIndex((s) => s.id === leagueId);
  if (idx < 0) return null;
  return SEASONS[idx + 1] ?? null;
}

interface GameStore {
  screen: Screen;
  /** Season chosen for the next new game. */
  seasonId: string;
  /** Seed chosen for the next new game (deterministic once fixed). */
  seed: number;
  /** League loaded for the chosen season (drives team select). */
  league: League;
  /** The whole career (source of truth); null before a game starts. */
  career: CareerState | null;
  /** Mirror of `career.season`, the in-progress season (drives the season screens). */
  season: SeasonState | null;
  /** Results of the most recently played matchday (for the season screen list). */
  lastResults: MatchResult[];
  viewingMatch: MatchResult | null;
  /** Current-squad player ids the human chose to RETAIN at season end. */
  retainIds: string[];
  /** Snapshot of the save slots (for the slots screen). */
  slots: Array<SlotInfo | null>;
  goTo: (screen: Screen) => void;
  chooseSeason: (id: string) => void;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;
  startCareer: (teamId: string) => void;
  playNextMatchday: () => void;
  toggleRetain: (playerId: string) => void;
  continueCareer: () => void;
  openMatch: (result: MatchResult) => void;
  refreshSlots: () => void;
  saveToSlot: (slot: number) => void;
  loadFromSlot: (slot: number) => void;
  deleteSlotAt: (slot: number) => void;
}

/**
 * The single bridge between the React UI and the pure game/engine layers. Every
 * action delegates to `@game`; components never run simulation logic themselves.
 * A career owns the world; `season` mirrors its in-progress season for the views.
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
    career: null,
    season: null,
    lastResults: [],
    viewingMatch: null,
    retainIds: [],
    slots: listSlots(),
    goTo: (screen) => set({ screen }),
    chooseSeason: (id) => {
      const entry = getSeason(id);
      if (entry) set({ seasonId: id, league: entry.load() });
    },
    setSeed: (seed) => set({ seed }),
    randomizeSeed: () => set({ seed: randomSeed() }),
    startCareer: (teamId) => {
      const { league, seed } = get();
      const career = newCareer(league, teamId, seed);
      set({
        career,
        season: career.season,
        lastResults: [],
        viewingMatch: null,
        retainIds: [],
        screen: 'season',
      });
    },
    playNextMatchday: () => {
      const { career } = get();
      if (!career) return;
      const step = advanceMatchday(career.season);
      set({ career: { ...career, season: step.state }, season: step.state, lastResults: step.played });
    },
    toggleRetain: (playerId) =>
      set((state) => ({
        retainIds: state.retainIds.includes(playerId)
          ? state.retainIds.filter((id) => id !== playerId)
          : [...state.retainIds, playerId],
      })),
    continueCareer: () => {
      const { career, retainIds } = get();
      if (!career) return;
      const entry = nextSeasonEntry(career.leagueId);
      if (!entry) return; // no historical data for the next season yet
      const nextWorld = entry.load();
      const next = applyTransition(career, nextWorld, new Set(retainIds));
      set({
        career: next,
        season: next.season,
        seasonId: entry.id,
        league: nextWorld,
        retainIds: [],
        lastResults: [],
        viewingMatch: null,
        screen: 'season',
      });
    },
    openMatch: (result) => set({ viewingMatch: result, screen: 'match' }),
    refreshSlots: () => set({ slots: listSlots() }),
    saveToSlot: (slot) => {
      const { career } = get();
      if (!career) return;
      writeSlot(slot, serializeCareer(career), Date.now());
      set({ slots: listSlots() });
    },
    loadFromSlot: (slot) => {
      const info = readSlot(slot);
      if (!info) return;
      const entry = getSeason(info.save.leagueId);
      if (!entry) return;
      const league = entry.load();
      const career = restoreCareer(info.save, league);
      set({
        career,
        season: career.season,
        seasonId: entry.id,
        league,
        lastResults: [],
        viewingMatch: null,
        retainIds: [],
        screen: 'season',
      });
    },
    deleteSlotAt: (slot) => {
      deleteSlot(slot);
      set({ slots: listSlots() });
    },
  };
});
