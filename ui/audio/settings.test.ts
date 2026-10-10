import { describe, it, expect, vi } from 'vitest';
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  clampVolume,
  loadAudioSettings,
  saveAudioSettings,
} from './settings';

/** Minimal in-memory Storage (the subset the module needs). */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    data,
  };
}

describe('clampVolume', () => {
  it('keeps values inside 0..1', () => {
    expect(clampVolume(0.4)).toBe(0.4);
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(7)).toBe(1);
  });

  it('falls back to the default for non-numeric input', () => {
    expect(clampVolume(NaN)).toBe(DEFAULT_AUDIO_SETTINGS.volume);
    expect(clampVolume('loud')).toBe(DEFAULT_AUDIO_SETTINGS.volume);
    expect(clampVolume(undefined)).toBe(DEFAULT_AUDIO_SETTINGS.volume);
    expect(clampVolume(Infinity)).toBe(1);
  });
});

describe('loadAudioSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadAudioSettings(memoryStorage())).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns the defaults when there is no storage at all', () => {
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('restores a saved preference', () => {
    const storage = memoryStorage({
      [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.25, muted: true }),
    });
    expect(loadAudioSettings(storage)).toEqual({ volume: 0.25, muted: true });
  });

  it('clamps an out-of-range stored volume', () => {
    const storage = memoryStorage({
      [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 9, muted: false }),
    });
    expect(loadAudioSettings(storage).volume).toBe(1);
  });

  it('ignores a corrupt payload', () => {
    expect(loadAudioSettings(memoryStorage({ [AUDIO_STORAGE_KEY]: '{not json' }))).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(loadAudioSettings(memoryStorage({ [AUDIO_STORAGE_KEY]: '"hola"' }))).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(loadAudioSettings(memoryStorage({ [AUDIO_STORAGE_KEY]: 'null' }))).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
  });

  it('only trusts a real boolean for `muted`', () => {
    const storage = memoryStorage({
      [AUDIO_STORAGE_KEY]: JSON.stringify({ volume: 0.5, muted: 'yes' }),
    });
    expect(loadAudioSettings(storage)).toEqual({ volume: 0.5, muted: false });
  });

  it('survives a storage whose getItem throws (private mode, blocked cookies)', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});

describe('saveAudioSettings', () => {
  it('writes the preference as JSON under the versioned key', () => {
    const storage = memoryStorage();
    saveAudioSettings({ volume: 0.3, muted: true }, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ volume: 0.3, muted: true }),
    );
    expect(loadAudioSettings(storage)).toEqual({ volume: 0.3, muted: true });
  });

  it('never throws when storage is missing or full', () => {
    expect(() => saveAudioSettings({ volume: 1, muted: false }, null)).not.toThrow();
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveAudioSettings({ volume: 1, muted: false }, full)).not.toThrow();
  });
});
