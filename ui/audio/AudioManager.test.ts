import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from './AudioManager';
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS } from './settings';
import { SOUNDS, SOUND_IDS, soundUrl } from './catalog';
import { FakeBackend } from './fakes';
import { NullBackend } from './backend';

/** In-memory Storage with the two methods the manager uses. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

interface Rig {
  backend: FakeBackend;
  storage: ReturnType<typeof memoryStorage>;
  manager: AudioManager;
  clock: { t: number };
}

function rig(initialStorage: Record<string, string> = {}): Rig {
  const backend = new FakeBackend();
  const storage = memoryStorage(initialStorage);
  const clock = { t: 1000 };
  const manager = new AudioManager({ backend, storage, now: () => clock.t, baseUrl: '/' });
  return { backend, storage, manager, clock };
}

/** Unlock the manager as the first user gesture would. */
async function unlocked(r: Rig): Promise<Rig> {
  await r.manager.unlock();
  return r;
}

describe('AudioManager settings', () => {
  it('starts from the saved preference and tells the engine', () => {
    const r = rig({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.3, muted: false }) });
    expect(r.manager.getSettings()).toEqual({ volume: 0.3, muted: false });
    expect(r.backend.master).toBeCloseTo(0.3);
  });

  it('starts from the defaults when nothing is saved', () => {
    const r = rig();
    expect(r.manager.getSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('starts silent when the saved preference is muted', () => {
    const r = rig({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.9, muted: true }) });
    expect(r.manager.getSettings().muted).toBe(true);
    expect(r.backend.master).toBe(0);
  });

  it('setVolume clamps, drives the engine, persists and notifies', () => {
    const r = rig();
    const listener = vi.fn();
    r.manager.subscribe(listener);
    r.manager.setVolume(2);
    expect(r.manager.getSettings().volume).toBe(1);
    expect(r.backend.master).toBe(1);
    expect(JSON.parse(r.storage.data.get(AUDIO_STORAGE_KEY)!)).toEqual({ volume: 1, muted: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when nothing changed', () => {
    const r = rig();
    const listener = vi.fn();
    r.manager.subscribe(listener);
    r.manager.setVolume(r.manager.getSettings().volume);
    r.manager.setMuted(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('hands out a new snapshot object only when something changes', () => {
    const r = rig();
    const before = r.manager.getSettings();
    expect(r.manager.getSettings()).toBe(before);
    r.manager.setVolume(0.1);
    expect(r.manager.getSettings()).not.toBe(before);
  });

  it('mute silences the engine and unmute restores the saved volume', () => {
    const r = rig();
    r.manager.setVolume(0.4);
    r.manager.setMuted(true);
    expect(r.backend.master).toBe(0);
    expect(r.manager.getSettings()).toEqual({ volume: 0.4, muted: true });
    r.manager.setMuted(false);
    expect(r.backend.master).toBeCloseTo(0.4);
  });

  it('toggleMuted flips the flag', () => {
    const r = rig();
    r.manager.toggleMuted();
    expect(r.manager.getSettings().muted).toBe(true);
    r.manager.toggleMuted();
    expect(r.manager.getSettings().muted).toBe(false);
  });

  it('stops notifying after unsubscribe', () => {
    const r = rig();
    const listener = vi.fn();
    const off = r.manager.subscribe(listener);
    off();
    r.manager.setVolume(0.2);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps working when storage is unavailable', () => {
    const manager = new AudioManager({ backend: new FakeBackend(), storage: null });
    expect(() => manager.setVolume(0.2)).not.toThrow();
    expect(manager.getSettings().volume).toBe(0.2);
  });
});

describe('AudioManager.play', () => {
  let r: Rig;
  beforeEach(async () => {
    r = await unlocked(rig());
  });

  it('plays a catalogue sound at its mix gain', () => {
    r.manager.play('goal');
    expect(r.backend.plays).toHaveLength(1);
    expect(r.backend.plays[0]).toMatchObject({ key: 'goal', gain: SOUNDS.goal.gain, loop: false });
  });

  it('scales the gain per call', () => {
    r.manager.play('click', { gain: 0.5 });
    expect(r.backend.plays[0]?.gain).toBeCloseTo(SOUNDS.click.gain * 0.5);
  });

  it('does nothing while muted, and plays again after unmuting', () => {
    r.manager.setMuted(true);
    r.manager.play('goal');
    expect(r.backend.plays).toHaveLength(0);
    r.manager.setMuted(false);
    r.manager.play('goal');
    expect(r.backend.plays).toHaveLength(1);
  });

  it('does nothing at volume zero', () => {
    r.manager.setVolume(0);
    r.manager.play('goal');
    expect(r.backend.plays).toHaveLength(0);
  });

  it('ignores a rapid repeat of the same sound but not other sounds', () => {
    r.manager.play('click');
    r.clock.t += 5;
    r.manager.play('click');
    r.manager.play('confirm');
    expect(r.backend.played).toEqual(['click', 'confirm']);
    r.clock.t += 100;
    r.manager.play('click');
    expect(r.backend.played).toEqual(['click', 'confirm', 'click']);
  });

  it('keeps a long whistle from stacking on itself, then lets it blow again', () => {
    r.manager.play('whistle-end');
    r.clock.t += 400;
    r.manager.play('whistle-end');
    expect(r.backend.played).toEqual(['whistle-end']);
    r.clock.t += SOUNDS['whistle-end'].minGapMs;
    r.manager.play('whistle-end');
    expect(r.backend.played).toEqual(['whistle-end', 'whistle-end']);
  });

  it('refuses to loop a sound the catalogue does not mark as a loop', () => {
    r.manager.startLoop('goal');
    expect(r.backend.plays).toHaveLength(0);
  });

  it('never throws when the engine does', () => {
    r.backend.play = () => {
      throw new Error('boom');
    };
    expect(() => r.manager.play('goal')).not.toThrow();
  });

  it('is a silent no-op on an engine without audio', () => {
    const manager = new AudioManager({ backend: new NullBackend(), storage: null });
    expect(() => manager.play('goal')).not.toThrow();
    expect(() => manager.startLoop('crowd')).not.toThrow();
  });
});

describe('AudioManager.play while a sound is still downloading', () => {
  /** A prefetch the test settles by hand. */
  function slowDownloads(r: Rig) {
    const pending: Array<() => void> = [];
    r.backend.prefetch = (key, url) => {
      r.backend.prefetched.push({ key, url });
      return new Promise<boolean>((resolve) => pending.push(() => resolve(true)));
    };
    return { land: () => pending.splice(0).forEach((resolve) => resolve()) };
  }
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  };

  it('plays it the moment it lands', async () => {
    const r = await unlocked(rig());
    const net = slowDownloads(r);
    void r.manager.preload(['confirm']);
    r.manager.play('confirm');
    expect(r.backend.plays).toHaveLength(0);
    net.land();
    await settle();
    expect(r.backend.played).toEqual(['confirm']);
  });

  it('drops it when the download takes so long that the moment has passed', async () => {
    const r = await unlocked(rig());
    const net = slowDownloads(r);
    void r.manager.preload(['confirm']);
    r.manager.play('confirm');
    r.clock.t += 5000;
    net.land();
    await settle();
    expect(r.backend.plays).toHaveLength(0);
  });

  it('stays quiet if the game was muted while it waited', async () => {
    const r = await unlocked(rig());
    const net = slowDownloads(r);
    void r.manager.preload(['confirm']);
    r.manager.play('confirm');
    r.manager.setMuted(true);
    net.land();
    await settle();
    expect(r.backend.plays).toHaveLength(0);
  });

  it('plays the confirm blip of an unmute that triggers the postponed download', async () => {
    const r = await unlocked(rig({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.7, muted: true }) }));
    const net = slowDownloads(r);
    await r.manager.preload();
    expect(r.backend.prefetched).toHaveLength(0);
    r.manager.setMuted(false);
    r.manager.play('confirm');
    net.land();
    await settle();
    expect(r.backend.played).toEqual(['confirm']);
  });
});

describe('AudioManager unlock', () => {
  it('wakes the engine once, however many gestures arrive', async () => {
    const r = rig();
    expect(r.manager.isUnlocked()).toBe(false);
    await Promise.all([r.manager.unlock(), r.manager.unlock()]);
    await r.manager.unlock();
    expect(r.backend.resumeCalls).toBe(1);
    expect(r.manager.isUnlocked()).toBe(true);
  });

  it('stays locked if the engine refuses to wake', async () => {
    const r = rig();
    r.backend.resume = () => Promise.reject(new Error('NotAllowedError'));
    await expect(r.manager.unlock()).resolves.toBeUndefined();
    expect(r.manager.isUnlocked()).toBe(false);
  });

  it('can retry after a refusal', async () => {
    const r = rig();
    const real = r.backend.resume.bind(r.backend);
    r.backend.resume = () => Promise.reject(new Error('NotAllowedError'));
    await r.manager.unlock();
    r.backend.resume = real;
    await r.manager.unlock();
    expect(r.manager.isUnlocked()).toBe(true);
  });
});

describe('AudioManager loops', () => {
  it('holds a loop requested before the unlock and starts it on unlock', async () => {
    const r = rig();
    r.manager.startLoop('crowd', 800);
    expect(r.backend.plays).toHaveLength(0);
    await r.manager.unlock();
    expect(r.backend.plays).toHaveLength(1);
    expect(r.backend.plays[0]).toMatchObject({
      key: 'crowd',
      loop: true,
      fadeInMs: 800,
      gain: SOUNDS.crowd.gain,
    });
  });

  it('starts a loop straight away once unlocked, and only once', async () => {
    const r = await unlocked(rig());
    r.manager.startLoop('crowd');
    r.manager.startLoop('crowd');
    expect(r.backend.plays).toHaveLength(1);
  });

  it('stops a running loop with a fade', async () => {
    const r = await unlocked(rig());
    r.manager.startLoop('crowd');
    r.manager.stopLoop('crowd', 600);
    expect(r.backend.plays[0]?.voice.stops).toEqual([600]);
    // Stopping again changes nothing.
    r.manager.stopLoop('crowd', 600);
    expect(r.backend.plays[0]?.voice.stops).toEqual([600]);
  });

  it('cancels a loop that was requested and then withdrawn before the unlock', async () => {
    const r = rig();
    r.manager.startLoop('crowd');
    r.manager.stopLoop('crowd');
    await r.manager.unlock();
    expect(r.backend.plays).toHaveLength(0);
  });

  it('can restart a loop after stopping it', async () => {
    const r = await unlocked(rig());
    r.manager.startLoop('crowd');
    r.manager.stopLoop('crowd');
    r.manager.startLoop('crowd');
    expect(r.backend.plays).toHaveLength(2);
  });

  it('keeps the loop alive through a mute so unmuting brings it back instantly', async () => {
    const r = await unlocked(rig());
    r.manager.startLoop('crowd');
    r.manager.setMuted(true);
    expect(r.backend.plays[0]?.voice.stopped).toBe(false);
    expect(r.backend.master).toBe(0);
    r.manager.setMuted(false);
    expect(r.backend.master).toBeGreaterThan(0);
    expect(r.backend.plays).toHaveLength(1);
  });
});

describe('AudioManager preload', () => {
  it('prefetches every catalogue sound once, from the right URLs', async () => {
    const r = rig();
    await r.manager.preload();
    await r.manager.preload();
    expect(r.backend.prefetched.map((p) => p.key).sort()).toEqual([...SOUND_IDS].sort());
    for (const p of r.backend.prefetched) {
      expect(p.url).toBe(soundUrl(p.key as (typeof SOUND_IDS)[number], '/'));
    }
  });

  it('can prefetch just a few sounds now and the rest later', async () => {
    const r = rig();
    await r.manager.preload(['click', 'confirm']);
    expect(r.backend.prefetched.map((p) => p.key)).toEqual(['click', 'confirm']);
    await r.manager.preload();
    expect(r.backend.prefetched).toHaveLength(SOUND_IDS.length);
  });

  it('waits while muted and downloads once the sound is switched on', async () => {
    const r = rig({ [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.7, muted: true }) });
    await r.manager.preload();
    expect(r.backend.prefetched).toHaveLength(0);
    r.manager.setMuted(false);
    await Promise.resolve();
    expect(r.backend.prefetched).toHaveLength(SOUND_IDS.length);
  });

  it('retries a sound whose download failed', async () => {
    const r = rig();
    let first = true;
    r.backend.prefetch = (key, url) => {
      r.backend.prefetched.push({ key, url });
      if (first) {
        first = false;
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    };
    await r.manager.preload(['click']);
    await r.manager.preload(['click']);
    expect(r.backend.prefetched.filter((p) => p.key === 'click')).toHaveLength(2);
  });
});

describe('AudioManager lifecycle', () => {
  it('suspends and resumes the engine only once it is unlocked', async () => {
    const r = rig();
    await r.manager.suspend();
    expect(r.backend.suspendCalls).toBe(0);
    await r.manager.unlock();
    await r.manager.suspend();
    expect(r.backend.suspendCalls).toBe(1);
    await r.manager.resume();
    expect(r.backend.resumeCalls).toBe(2);
  });

  it('dispose stops loops and releases the engine', async () => {
    const r = await unlocked(rig());
    r.manager.startLoop('crowd');
    r.manager.dispose();
    expect(r.backend.plays[0]?.voice.stopped).toBe(true);
    expect(r.backend.disposed).toBe(true);
  });
});
