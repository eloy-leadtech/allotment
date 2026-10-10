import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchResult } from '@engine';
import { MatchScreen } from '@ui/screens/MatchScreen';
import { useGameStore } from '@ui/store/gameStore';
import { startAudioDirector } from './director';
import { FakePlayer } from './fakes';

/**
 * Contract test: the REAL match screen driven by the REAL store, with the director
 * listening. It pins what the sound layer relies on from the match screen: its
 * scoreboard clock (`.sb__status`: "N'" then "Final") and `viewingMatch.events`.
 * If you restructure the match screen (new view modes, a different reveal clock),
 * keep that clock readable, or this test tells you the sound went silent.
 * (See ui/audio/README.md.)
 */

function startCareerAndPickAMatch(): MatchResult {
  useGameStore.setState({ career: null, season: null, screen: 'title', viewingMatch: null, lastResults: [] });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
  const { season, career } = useGameStore.getState();
  const mine = career!.humanTeamId;
  const rival = season!.teams.find((t) => t.id !== mine)!.id;
  // One goal for the human side: kick-off, goal, final — the shortest match that
  // exercises every cue (and it is over in about two seconds).
  return {
    homeId: mine,
    awayId: rival,
    homeGoals: 1,
    awayGoals: 0,
    events: [{ min: 20, type: 'goal', team: 'home', playerId: 'x', playerName: 'Jugador de prueba' }],
  };
}

function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('the sound layer on the real match screen', () => {
  let player: FakePlayer;
  let stop: (() => void) | undefined;
  let match: MatchResult;

  beforeEach(() => {
    // jsdom has no canvas; a 2D viewer that draws on one should just find none.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    player = new FakePlayer();
    match = startCareerAndPickAMatch();
    stop = startAudioDirector({ player, store: useGameStore });
  });

  afterEach(() => {
    stop?.();
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
    useGameStore.setState({ viewingMatch: null, screen: 'title' });
  });

  it('follows a match from kick-off to the final whistle, and cheers your win', async () => {
    setReducedMotion(false);
    act(() => useGameStore.setState({ viewingMatch: match, screen: 'match' }));
    render(<MatchScreen />);
    await waitFor(() => expect(player.cues).toEqual(['whistle-start', 'goal', 'whistle-end', 'cheer']), {
      timeout: 12_000,
      interval: 100,
    });
    expect(player.loopsStarted).toEqual(['crowd']);
    expect(player.loopsStopped).toEqual(['crowd']);
  }, 20_000);

  it('says only the final whistle when the screen opens already finished (reduced motion)', async () => {
    setReducedMotion(true);
    act(() => useGameStore.setState({ viewingMatch: match, screen: 'match' }));
    render(<MatchScreen />);
    await waitFor(() => expect(player.cues).toEqual(['whistle-end', 'cheer']), { timeout: 5000, interval: 50 });
  });
});
