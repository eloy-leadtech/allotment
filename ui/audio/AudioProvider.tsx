import { useEffect, useMemo, type ReactNode } from 'react';
import type { AudioManager } from './AudioManager';
import { getAudioManager } from './defaultManager';
import { startAudioDirector, type DirectorStore } from './director';
import { SoundControl, type SoundControlCorner } from './SoundControl';
import { AudioManagerContext } from './useSound';
import './audio.css';

export interface AudioProviderProps {
  children?: ReactNode;
  /**
   * The game store whose changes the director listens to (pass `useGameStore`).
   * Taken as a prop so this layer stays independent of the store module.
   */
  store: DirectorStore;
  /** Sound engine to use; defaults to the app-wide one. Tests inject their own. */
  manager?: AudioManager;
  /** Show the floating mute/volume pill (default). Turn off if an options screen hosts `<SoundSettings />`. */
  floatingControl?: boolean;
  /** Which viewport corner the floating pill sits in (default bottom-right). */
  corner?: SoundControlCorner;
}

/** The small UI sounds are fetched at once so the very first click already ticks. */
const FIRST_SOUNDS = ['click', 'confirm'] as const;
/** The rest of the pack (crowd, goals, whistles) trails in once the app has settled. */
const REST_DELAY_MS = 2000;

/**
 * Mount ONCE, at the root of the app. Brings the whole sound layer to life
 * without any screen taking part: it starts the director (clicks, matchday
 * results, live match events), preloads the sound pack, parks the audio engine
 * while the tab is hidden, and offers the volume/mute control.
 */
export function AudioProvider({
  children,
  store,
  manager: injected,
  floatingControl = true,
  corner,
}: AudioProviderProps) {
  const manager = useMemo(() => injected ?? getAudioManager(), [injected]);

  useEffect(() => {
    void manager.preload(FIRST_SOUNDS);
    const rest = setTimeout(() => void manager.preload(), REST_DELAY_MS);
    const stopDirector = startAudioDirector({ player: manager, store });
    const onVisibility = (): void => {
      void (document.hidden ? manager.suspend() : manager.resume());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(rest);
      stopDirector();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [manager, store]);

  return (
    <AudioManagerContext.Provider value={manager}>
      {children}
      {floatingControl ? <SoundControl corner={corner} /> : null}
    </AudioManagerContext.Provider>
  );
}
