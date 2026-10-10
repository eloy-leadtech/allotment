import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { AudioManager } from './AudioManager';
import type { SoundId } from './catalog';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from './settings';

/** Carries the app's AudioManager down to `useSound`; set by `<AudioProvider>`. */
export const AudioManagerContext = createContext<AudioManager | null>(null);

export interface UseSound {
  /** Play a one-shot (fire and forget; silent when muted or unsupported). */
  play: (id: SoundId, options?: { gain?: number }) => void;
  settings: AudioSettings;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  /** False on platforms that cannot produce sound at all. */
  supported: boolean;
}

const noop = (): void => {};
const noSubscribe = (): (() => void) => noop;

/** What `useSound` returns outside an `<AudioProvider>` (e.g. a screen rendered alone in a test). */
const SILENT: UseSound = {
  play: noop,
  settings: DEFAULT_AUDIO_SETTINGS,
  setVolume: noop,
  setMuted: noop,
  toggleMuted: noop,
  supported: false,
};

/**
 * Sound for components. Screens never need it for clicks (the provider already
 * ticks every button), but a screen can `play('goal')` for something special, or
 * a settings screen can drive volume/mute with it. Without a provider it is a
 * harmless no-op, so components stay testable in isolation.
 */
export function useSound(): UseSound {
  const manager = useContext(AudioManagerContext);
  const subscribe = useMemo(
    () => (manager ? (onChange: () => void) => manager.subscribe(onChange) : noSubscribe),
    [manager],
  );
  const getSnapshot = useMemo(
    () => (manager ? () => manager.getSettings() : () => DEFAULT_AUDIO_SETTINGS),
    [manager],
  );
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo<UseSound>(() => {
    if (!manager) return SILENT;
    return {
      play: (id, options) => manager.play(id, options),
      settings,
      setVolume: (volume) => manager.setVolume(volume),
      setMuted: (muted) => manager.setMuted(muted),
      toggleMuted: () => manager.toggleMuted(),
      supported: manager.supported,
    };
  }, [manager, settings]);
}
