/**
 * Persisted sound preferences (master volume + mute). Lives in /ui because
 * localStorage is a browser API. Every access is wrapped: storage can be missing,
 * blocked (private mode / cookies off) or full, and none of that may break the
 * game — the worst case is that the preference is simply not remembered.
 */
export interface AudioSettings {
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { volume: 0.7, muted: false };

/** Versioned so a future change of shape can ignore old payloads. */
export const AUDIO_STORAGE_KEY = 'pcf.audio.v1';

/** Read side of a Storage (what loading needs). */
export type ReadableStorage = Pick<Storage, 'getItem'>;
/** Write side of a Storage (what saving needs). */
export type WritableStorage = Pick<Storage, 'setItem'>;

/** Clamp to 0..1; anything that is not a number falls back to the default volume. */
export function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_AUDIO_SETTINGS.volume;
  return Math.min(1, Math.max(0, value));
}

/** `window.localStorage`, or null when the platform refuses to hand it out. */
export function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Load the saved preference, falling back to the defaults on any problem. */
export function loadAudioSettings(storage: ReadableStorage | null): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_AUDIO_SETTINGS };
    const { volume, muted } = parsed as Record<string, unknown>;
    return {
      volume: clampVolume(volume),
      muted: muted === true,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** Save the preference; silently does nothing when storage is unavailable. */
export function saveAudioSettings(settings: AudioSettings, storage: WritableStorage | null): void {
  if (!storage) return;
  try {
    storage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ volume: settings.volume, muted: settings.muted }),
    );
  } catch {
    /* quota or blocked storage: the preference just is not remembered */
  }
}
