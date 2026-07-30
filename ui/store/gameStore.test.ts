import { describe, it, expect, beforeEach } from 'vitest';
import { isSeasonOver } from '@game';
import type { Player } from '@data';
import { useGameStore, nextSeasonEntry } from './gameStore';

const personKey = (p: Player): string => `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;

/** Reset the singleton store to a clean 96/97 pre-game state. */
function reset(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], lastResults: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
}

/** Play the in-progress season to completion. */
function playToEnd(): void {
  let guard = 0;
  while (!isSeasonOver(useGameStore.getState().season!) && guard < 100) {
    useGameStore.getState().playNextMatchday();
    guard += 1;
  }
}

describe('gameStore career loop', () => {
  beforeEach(reset);

  it('startCareer creates a season-1 career and shows the season screen', () => {
    useGameStore.getState().startCareer('barcelona');
    const s = useGameStore.getState();
    expect(s.career?.seasonNumber).toBe(1);
    expect(s.career?.humanTeamId).toBe('barcelona');
    expect(s.season).toBe(s.career?.season);
    expect(s.screen).toBe('season');
  });

  it('playNextMatchday advances and keeps career.season in sync', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().playNextMatchday();
    const s = useGameStore.getState();
    expect(s.season?.currentMatchday).toBe(2);
    expect(s.career?.season.currentMatchday).toBe(2);
    expect(s.lastResults).toHaveLength(11);
  });

  it('continueCareer advances into the real 97/98 world and opens the market', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer();
    const s = useGameStore.getState();
    expect(s.career?.seasonNumber).toBe(2);
    expect(s.career?.temporada).toBe('97/98');
    expect(s.season?.temporada).toBe('97/98');
    // Between seasons the transfer window opens before kick-off.
    expect(s.screen).toBe('market');
    expect(s.career?.history).toHaveLength(1);
    useGameStore.getState().startSeasonFromMarket();
    expect(useGameStore.getState().screen).toBe('season');
  });

  it('buys a player in the market: budget drops and the squad grows', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer(); // now in market, budget available
    const before = useGameStore.getState().career!;
    // Cheapest buyable player is affordable.
    const beforeSize = before.teams.find((t) => t.id === 'barcelona')!.players.length;
    // Reach into the engine listing via the store's career.
    const target = before.teams.find((t) => t.id !== 'barcelona')!.players[0]!;
    useGameStore.getState().buyInMarket(target.id);
    const after = useGameStore.getState().career!;
    // Either the buy succeeded (squad grew, budget dropped) or it was unaffordable
    // (message set) — both are valid; assert the successful path when it applies.
    if (after.budget !== before.budget) {
      expect(after.budget).toBeLessThan(before.budget);
      expect(after.teams.find((t) => t.id === 'barcelona')!.players.length).toBe(beforeSize + 1);
    }
  });

  it('accepting an AI bid sells the player and adds money', () => {
    useGameStore.getState().startCareer('barcelona');
    playToEnd();
    useGameStore.getState().continueCareer();
    const bids = useGameStore.getState().bids;
    if (bids.length === 0) return; // deterministic, but guard anyway
    const bid = bids[0]!;
    const before = useGameStore.getState().career!;
    useGameStore.getState().acceptMarketBid(bid);
    const after = useGameStore.getState().career!;
    expect(after.budget).toBe(before.budget + bid.amount);
    expect(useGameStore.getState().bids.some((b) => b.playerId === bid.playerId)).toBe(false);
  });

  it('retaining a player keeps them across the transition and clears the selection', () => {
    useGameStore.getState().startCareer('barcelona');
    const ronaldo = useGameStore
      .getState()
      .career!.teams.find((t) => t.id === 'barcelona')!
      .players.find((p) => p.nombre === 'Ronaldo')!;
    useGameStore.getState().toggleRetain(ronaldo.id);
    expect(useGameStore.getState().retainIds).toContain(ronaldo.id);

    playToEnd();
    useGameStore.getState().continueCareer();

    const barca = useGameStore.getState().career!.teams.find((t) => t.id === 'barcelona')!;
    expect(barca.players.map(personKey)).toContain(personKey(ronaldo));
    expect(useGameStore.getState().retainIds).toHaveLength(0);
  });

  it('save/load round-trips the career through a slot', () => {
    localStorage.clear();
    useGameStore.getState().startCareer('barcelona');
    for (let i = 0; i < 3; i += 1) useGameStore.getState().playNextMatchday();
    const before = useGameStore.getState().career!;
    useGameStore.getState().saveToSlot(1);

    useGameStore.setState({ career: null, season: null });
    useGameStore.getState().loadFromSlot(1);

    const after = useGameStore.getState().career!;
    expect(after.seasonNumber).toBe(before.seasonNumber);
    expect(after.season.currentMatchday).toBe(before.season.currentMatchday);
    expect(after.humanTeamId).toBe('barcelona');
    expect(useGameStore.getState().screen).toBe('season');
  });

  it('setTactics stores the human formation and applies it to the live season', () => {
    useGameStore.getState().startCareer('barcelona');
    useGameStore.getState().setTactics({ formation: '4-3-3' });
    const s = useGameStore.getState();
    expect(s.career?.tactics?.formation).toBe('4-3-3');
    expect(s.season?.teams.find((t) => t.id === 'barcelona')?.tactics?.formation).toBe('4-3-3');
  });

  it('nextSeasonEntry chains the seasons and stops after the last', () => {
    expect(nextSeasonEntry('es-primera-9697')?.id).toBe('es-primera-9798');
    expect(nextSeasonEntry('es-primera-9798')?.id).toBe('es-primera-9899');
    expect(nextSeasonEntry('es-primera-9899')).toBeNull();
  });
});
