import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { MatchEvent, MatchResult } from '@engine';
import {
  beatsBetween,
  cuesForBatch,
  humanResult,
  parseScoreboardClock,
  soundForClick,
  startAudioDirector,
  type DirectorState,
} from './director';
import { FakePlayer } from './fakes';

// ─── helpers ───

function result(homeGoals: number, awayGoals: number, homeId = 'mine', awayId = 'rival'): MatchResult {
  return { homeId, awayId, homeGoals, awayGoals, events: [] };
}

function makeStore(partial: Partial<DirectorState> = {}) {
  return createStore<DirectorState>(() => ({
    screen: 'title',
    lastResults: [],
    viewingMatch: null,
    career: null,
    ...partial,
  }));
}

/** Let MutationObserver callbacks (microtasks) run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

function ev(min: number, type: MatchEvent['type'], team: 'home' | 'away' = 'home'): MatchEvent {
  return { min, type, team, playerId: `p${min}`, playerName: `Jugador ${min}` };
}

/**
 * Stand-in for the match screen's scoreboard: the `.sb__status` element whose text
 * is the minute of the latest revealed beat ("14'") or "Final". Updated in place
 * like React does (same element, new text), which is what the director watches.
 */
function scoreboard() {
  document.body.innerHTML =
    '<main><section class="sb"><span class="sb__status sb__status--live"><span class="sb__live-dot"></span><span class="t"></span></span></section></main>';
  const text = document.querySelector('.sb__status .t')!;
  return {
    show: async (label: string): Promise<void> => {
      text.textContent = label;
      await flush();
    },
  };
}

const html = (markup: string): void => {
  document.body.innerHTML = markup;
};

const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
};

// ─── pure helpers ───

describe('soundForClick', () => {
  it('maps a plain button to the click tick and a primary button to the confirm blip', () => {
    html(`<button id="a">Plantilla</button><button id="b" class="retro-btn retro-btn--primary">Jugar</button>`);
    expect(soundForClick(byId('a'))).toBe('click');
    expect(soundForClick(byId('b'))).toBe('confirm');
  });

  it('finds the button when the click lands on something inside it', () => {
    html(`<button id="a"><span id="inner"><b id="deep">Ver</b></span></button>`);
    expect(soundForClick(byId('inner'))).toBe('click');
    expect(soundForClick(byId('deep'))).toBe('click');
  });

  it('treats links, role=button/tab and checkboxes as clickable', () => {
    html(`
      <a id="link" href="#x">x</a><a id="nolink">x</a>
      <div id="rb" role="button">x</div><div id="tab" role="tab">x</div>
      <input id="chk" type="checkbox"><input id="txt" type="text">`);
    expect(soundForClick(byId('link'))).toBe('click');
    expect(soundForClick(byId('rb'))).toBe('click');
    expect(soundForClick(byId('tab'))).toBe('click');
    expect(soundForClick(byId('chk'))).toBe('click');
    expect(soundForClick(byId('nolink'))).toBeNull();
    expect(soundForClick(byId('txt'))).toBeNull();
  });

  it('stays silent on non-interactive ground', () => {
    html(`<div id="d"><p id="p">texto</p></div>`);
    expect(soundForClick(byId('p'))).toBeNull();
    expect(soundForClick(document.body)).toBeNull();
    expect(soundForClick(null)).toBeNull();
  });

  it('stays silent on disabled controls', () => {
    html(`
      <button id="a" disabled><span id="a1">x</span></button>
      <button id="b" aria-disabled="true">x</button>
      <fieldset disabled><button id="c">x</button></fieldset>`);
    expect(soundForClick(byId('a1'))).toBeNull();
    expect(soundForClick(byId('b'))).toBeNull();
    expect(soundForClick(byId('c'))).toBeNull();
  });

  it('honours data-sound: off silences a whole region, a sound id overrides the default', () => {
    html(`
      <section data-sound="off"><button id="a">x</button></section>
      <button id="b" data-sound="goal">x</button>
      <button id="c" class="retro-btn--primary" data-sound="click">x</button>
      <button id="d" data-sound="nonsense">x</button>
      <button id="e" data-sound="crowd">x</button>`);
    expect(soundForClick(byId('a'))).toBeNull();
    expect(soundForClick(byId('b'))).toBe('goal');
    expect(soundForClick(byId('c'))).toBe('click');
    expect(soundForClick(byId('d'))).toBe('click'); // unknown value: fall back to the default
    expect(soundForClick(byId('e'))).toBe('click'); // a loop is not a click sound
  });
});

describe('parseScoreboardClock', () => {
  it('reads the minute of the latest beat', () => {
    expect(parseScoreboardClock("14'")).toEqual({ kind: 'minute', minute: 14 });
    expect(parseScoreboardClock(' 7\u2019 ')).toEqual({ kind: 'minute', minute: 7 });
    expect(parseScoreboardClock("0'")).toEqual({ kind: 'minute', minute: 0 });
    expect(parseScoreboardClock('90')).toEqual({ kind: 'minute', minute: 90 });
  });

  it('reads the final whistle', () => {
    expect(parseScoreboardClock('Final')).toEqual({ kind: 'final' });
    expect(parseScoreboardClock(' FINAL ')).toEqual({ kind: 'final' });
  });

  it('ignores anything else', () => {
    expect(parseScoreboardClock('')).toBeNull();
    expect(parseScoreboardClock(null)).toBeNull();
    expect(parseScoreboardClock(undefined)).toBeNull();
    expect(parseScoreboardClock('En directo')).toBeNull();
    expect(parseScoreboardClock("14' extra")).toBeNull();
  });
});

describe('beatsBetween', () => {
  const events = [ev(4, 'corner'), ev(22, 'goal'), ev(32, 'chance'), ev(32, 'yellow'), ev(70, 'red')];

  it('opens with the kick-off the first time the clock is seen', () => {
    expect(beatsBetween(events, -1, { kind: 'minute', minute: 0 })).toEqual(['kickoff']);
  });

  it('lists the events the clock has just passed, in order, ties included', () => {
    expect(beatsBetween(events, 4, { kind: 'minute', minute: 32 })).toEqual(['goal', 'chance', 'yellow']);
    expect(beatsBetween(events, 32, { kind: 'minute', minute: 40 })).toEqual([]);
  });

  it('brings the whole remainder plus the final whistle on a final', () => {
    expect(beatsBetween(events, 32, { kind: 'final' })).toEqual(['red', 'final']);
    expect(beatsBetween([], -1, { kind: 'final' })).toEqual(['kickoff', 'final']);
  });
});

describe('cuesForBatch', () => {
  const ids = (kinds: Parameters<typeof cuesForBatch>[0]) => cuesForBatch(kinds).map((c) => c.id);

  it('maps the live beats to their cues', () => {
    expect(ids(['kickoff'])).toEqual(['whistle-start']);
    expect(ids(['goal'])).toEqual(['goal']);
    expect(ids(['yellow'])).toEqual(['card-yellow']);
    expect(ids(['red'])).toEqual(['card-red']);
    expect(ids(['secondYellow'])).toEqual(['card-red']);
    expect(ids(['final'])).toEqual(['whistle-end']);
  });

  it('is silent for beats that are only colour', () => {
    expect(ids(['chance', 'saved', 'offTarget'])).toEqual([]);
    expect(ids(['post', 'corner', 'foul'])).toEqual([]);
    expect(ids(['injury'])).toEqual([]);
  });

  it('plays the most important cue first and at most two', () => {
    expect(ids(['yellow', 'goal'])).toEqual(['goal', 'card-yellow']);
    expect(ids(['yellow', 'red', 'goal'])).toEqual(['goal', 'card-red']);
  });

  it('never repeats a cue inside one batch', () => {
    expect(ids(['yellow', 'yellow'])).toEqual(['card-yellow']);
    expect(ids(['red', 'secondYellow'])).toEqual(['card-red']);
  });

  it('staggers a second cue so the two do not collide', () => {
    const [first, second] = cuesForBatch(['goal', 'yellow']);
    expect(second!.delayMs).toBeGreaterThan(first!.delayMs);
  });

  it('holds the kick-off whistle back a beat so it clears the confirm blip', () => {
    expect(cuesForBatch(['kickoff'])[0]!.delayMs).toBeGreaterThan(0);
    expect(cuesForBatch(['goal'])[0]!.delayMs).toBe(0);
  });

  it('lets a final that arrives with other beats be the only sound', () => {
    expect(ids(['kickoff', 'final'])).toEqual(['whistle-end']);
    expect(ids(['goal', 'final'])).toEqual(['whistle-end']);
  });

  it('collapses a "show me everything" jump to nothing (a final is handled above)', () => {
    expect(ids(['kickoff', 'goal', 'yellow', 'chance', 'goal'])).toEqual([]);
    expect(ids(['kickoff', 'goal', 'goal', 'yellow', 'red'])).toEqual([]);
  });
});

describe('humanResult', () => {
  it('reads the result from the human side, home or away', () => {
    expect(humanResult(result(2, 1), 'mine')).toBe('win');
    expect(humanResult(result(1, 1), 'mine')).toBe('draw');
    expect(humanResult(result(0, 3), 'mine')).toBe('loss');
    expect(humanResult(result(0, 3, 'rival', 'mine'), 'mine')).toBe('win');
    expect(humanResult(result(2, 2, 'rival', 'mine'), 'mine')).toBe('draw');
    expect(humanResult(result(5, 0, 'rival', 'mine'), 'mine')).toBe('loss');
  });

  it('is null when the human is not in that match or unknown', () => {
    expect(humanResult(result(2, 1, 'a', 'b'), 'mine')).toBeNull();
    expect(humanResult(result(2, 1), undefined)).toBeNull();
    expect(humanResult(null, 'mine')).toBeNull();
  });
});

// ─── the director ───

describe('startAudioDirector', () => {
  let player: FakePlayer;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    player = new FakePlayer();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
  });

  const start = (store = makeStore()) => {
    stop = startAudioDirector({ player, store });
    return store;
  };

  describe('clicks and the first gesture', () => {
    it('plays the click tick for any button, anywhere in the app', () => {
      start();
      html(`<main><button id="a">Mercado</button><button id="b" class="retro-btn--primary">Jugar</button></main>`);
      byId('a').click();
      byId('b').click();
      expect(player.cues).toEqual(['click', 'confirm']);
    });

    it('ignores clicks on plain content', () => {
      start();
      html(`<p id="p">hola</p>`);
      byId('p').click();
      expect(player.cues).toEqual([]);
    });

    it('wakes the audio engine on the first gesture, then stops listening', () => {
      start();
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(player.unlockCalls).toBe(1);
      return Promise.resolve().then(() => {
        document.dispatchEvent(new Event('keydown', { bubbles: true }));
        document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(player.unlockCalls).toBe(1);
      });
    });

    it('also unlocks on a keyboard gesture and on a click that had no pointerdown', () => {
      start();
      document.dispatchEvent(new Event('keydown', { bubbles: true }));
      expect(player.unlockCalls).toBe(1);

      const second = new FakePlayer();
      document.body.innerHTML = '<button id="a">x</button>';
      stop?.();
      stop = startAudioDirector({ player: second, store: makeStore() });
      byId('a').click();
      expect(second.unlockCalls).toBe(1);
      expect(second.cues).toEqual(['click']);
    });

    it('keeps trying to unlock until the browser lets it', async () => {
      start();
      player.unlock = () => {
        player.unlockCalls += 1;
        return Promise.resolve(); // still locked: isUnlocked() stays false
      };
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await Promise.resolve();
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(player.unlockCalls).toBe(2);
    });

    it('stops reacting once it is stopped', () => {
      start();
      html(`<button id="a">x</button>`);
      stop?.();
      stop = undefined;
      byId('a').click();
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(player.cues).toEqual([]);
      expect(player.unlockCalls).toBe(0);
    });
  });

  describe('stadium ambience', () => {
    it('brings the crowd in when a match goes on screen and out when it leaves', () => {
      const store = start();
      store.setState({ screen: 'match', viewingMatch: result(1, 0) });
      expect(player.loopsStarted).toEqual(['crowd']);
      store.setState({ screen: 'season' });
      expect(player.loopsStopped).toEqual(['crowd']);
    });

    it('does not restart the crowd on unrelated store updates', () => {
      const store = start();
      store.setState({ screen: 'match', viewingMatch: result(1, 0) });
      store.setState({ lastResults: [] });
      expect(player.loopsStarted).toEqual(['crowd']);
    });

    it('stays quiet on the match screen when there is no match to watch', () => {
      const store = start();
      store.setState({ screen: 'match', viewingMatch: null });
      expect(player.loopsStarted).toEqual([]);
    });

    it('picks the crowd up if the match is already showing when it starts', () => {
      start(makeStore({ screen: 'match', viewingMatch: result(0, 0) }));
      expect(player.loopsStarted).toEqual(['crowd']);
    });

    it('fades the crowd out when it is stopped', () => {
      const store = start();
      store.setState({ screen: 'match', viewingMatch: result(1, 0) });
      stop?.();
      stop = undefined;
      expect(player.loopsStopped).toEqual(['crowd']);
    });
  });

  describe('live match events (read off the scoreboard clock)', () => {
    const match: MatchResult = {
      homeId: 'mine',
      awayId: 'rival',
      homeGoals: 2,
      awayGoals: 1,
      events: [
        ev(4, 'corner'),
        ev(22, 'goal'),
        ev(32, 'chance'),
        ev(32, 'yellow', 'away'),
        ev(58, 'secondYellow', 'away'),
        ev(70, 'red', 'away'),
        ev(80, 'injury'),
        ev(85, 'goal'),
      ],
    };

    const live = (partial: Partial<DirectorState> = {}) =>
      start(
        makeStore({
          screen: 'match',
          viewingMatch: match,
          career: { humanTeamId: 'mine' },
          ...partial,
        }),
      );

    it("blows the whistle for kick-off a beat after the clock first reads 0'", async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      expect(player.cues).toEqual([]);
      vi.advanceTimersByTime(400);
      expect(player.cues).toEqual(['whistle-start']);
    });

    it('reacts to goals and cards as the clock passes them, whatever view shows them', async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      player.cues.length = 0;

      for (const label of ["4'", "22'", "32'", "58'", "70'", "80'", "85'"]) {
        await sb.show(label);
      }
      expect(player.cues).toEqual(['goal', 'card-yellow', 'card-red', 'card-red', 'goal']);
    });

    it('plays an event shown at the same minute as the last one exactly once', async () => {
      live();
      const sb = scoreboard();
      await sb.show("22'");
      player.cues.length = 0;
      await sb.show("32'");
      await sb.show("32'");
      expect(player.cues).toEqual(['card-yellow']);
    });

    it('stays silent while paused (the clock does not move)', async () => {
      live();
      const sb = scoreboard();
      await sb.show("22'");
      player.cues.length = 0;
      await sb.show("22'");
      await sb.show("22'");
      expect(player.cues).toEqual([]);
    });

    it('closes with the final whistle, the crowd fading out, and a cheer if you won', async () => {
      live();
      const sb = scoreboard();
      await sb.show("85'");
      player.cues.length = 0;
      await sb.show('Final');
      expect(player.cues).toEqual(['whistle-end']);
      expect(player.loopsStopped).toEqual(['crowd']);
      vi.advanceTimersByTime(1500);
      expect(player.cues).toEqual(['whistle-end', 'cheer']);
    });

    it.each([
      ['a draw', result(1, 1)],
      ['a defeat', result(0, 2)],
      ["someone else's match", result(3, 0, 'a', 'b')],
    ])('does not cheer after %s', async (_label, drawn) => {
      live({ viewingMatch: drawn });
      const sb = scoreboard();
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end']);
    });

    it('cheers a win with the human team playing away too', async () => {
      live({ viewingMatch: result(0, 1, 'rival', 'mine') });
      const sb = scoreboard();
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end', 'cheer']);
    });

    it('collapses a jump to the end ("Final" button, "Ver resumen") to the final whistle', async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      await sb.show("4'");
      player.cues.length = 0;
      await sb.show('Final');
      expect(player.cues).toEqual(['whistle-end']);
    });

    it('collapses a reduced-motion screen that opens already on "Final"', async () => {
      live();
      const sb = scoreboard();
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end', 'cheer']);
    });

    it('lets a jump to the end swallow a kick-off whistle that is still waiting', async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(100); // the whistle is due at 250 ms
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end', 'cheer']);
    });

    it('drops cues still waiting when the match screen is left', async () => {
      const store = live();
      const sb = scoreboard();
      await sb.show('Final');
      expect(player.cues).toEqual(['whistle-end']); // the cheer is due in 900 ms
      store.setState({ screen: 'season' });
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end']);
    });

    it('collapses a big jump between two minutes (tab was hidden) to silence', async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      player.cues.length = 0;
      await sb.show("85'");
      expect(player.cues).toEqual([]);
    });

    it('plays the replay again from the top, crowd included', async () => {
      live();
      const sb = scoreboard();
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      player.cues.length = 0;
      player.loopsStarted.length = 0;
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      await sb.show("22'");
      expect(player.cues).toEqual(['whistle-start', 'goal']);
      expect(player.loopsStarted).toEqual(['crowd']);
    });

    it('is not fooled by a scoreboard it cannot read', async () => {
      live();
      const sb = scoreboard();
      await sb.show('En directo');
      await sb.show('');
      expect(player.cues).toEqual([]);
    });

    it('does nothing when the screen has no scoreboard', async () => {
      live();
      document.body.innerHTML = '<main><p>No hay partido seleccionado.</p></main>';
      await flush();
      expect(player.cues).toEqual([]);
    });

    it('stays silent for scoreboards shown outside a live match', async () => {
      start(makeStore({ screen: 'copa', viewingMatch: match }));
      const sb = scoreboard();
      await sb.show("22'");
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual([]);
    });

    it('stops listening when the match screen is left', async () => {
      const store = live();
      const sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      player.cues.length = 0;
      store.setState({ screen: 'season' });
      await sb.show("22'");
      expect(player.cues).toEqual([]);
    });

    it('starts from a fresh clock for the next match', async () => {
      const store = live();
      let sb = scoreboard();
      await sb.show('Final');
      vi.advanceTimersByTime(3000);
      store.setState({ screen: 'season', viewingMatch: null });
      player.cues.length = 0;
      store.setState({ screen: 'match', viewingMatch: match });
      sb = scoreboard();
      await sb.show("0'");
      vi.advanceTimersByTime(400);
      expect(player.cues).toEqual(['whistle-start']);
    });

    it('cancels pending cues when stopped', async () => {
      live();
      const sb = scoreboard();
      await sb.show("0'");
      stop?.();
      stop = undefined;
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual([]);
    });
  });

  describe('end of the matchday without watching', () => {
    it('blows the final whistle a beat after the results land, and cheers a win', () => {
      const store = start(makeStore({ screen: 'season', career: { humanTeamId: 'mine' } }));
      store.setState({ lastResults: [result(3, 0, 'x', 'y'), result(2, 0)] });
      expect(player.cues).toEqual([]);
      vi.advanceTimersByTime(400);
      expect(player.cues).toEqual(['whistle-end']);
      vi.advanceTimersByTime(1500);
      expect(player.cues).toEqual(['whistle-end', 'cheer']);
    });

    it('only whistles after a draw or a defeat', () => {
      const store = start(makeStore({ screen: 'season', career: { humanTeamId: 'mine' } }));
      store.setState({ lastResults: [result(0, 1)] });
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end']);
    });

    it('does not double up with the live view (the teletipo owns those whistles)', () => {
      const store = start(makeStore({ career: { humanTeamId: 'mine' } }));
      store.setState({ screen: 'match', viewingMatch: result(1, 0), lastResults: [result(1, 0)] });
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual([]);
    });

    it('ignores an emptied result list and unrelated updates', () => {
      const store = start(makeStore({ screen: 'season' }));
      store.setState({ lastResults: [] });
      store.setState({ screen: 'squad' });
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual([]);
    });

    it('whistles again for the next matchday', () => {
      const store = start(makeStore({ screen: 'season' }));
      store.setState({ lastResults: [result(1, 0)] });
      vi.advanceTimersByTime(3000);
      store.setState({ lastResults: [result(0, 0)] });
      vi.advanceTimersByTime(3000);
      expect(player.cues).toEqual(['whistle-end', 'whistle-end']);
    });
  });
});
