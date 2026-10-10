import { AudioManager } from './AudioManager';
import { NullBackend } from './backend';
import { WebAudioBackend } from './WebAudioBackend';

let shared: AudioManager | null = null;

/**
 * The app-wide sound engine: one per page, created on first use (constructing it
 * touches no audio hardware, so it is safe to call during render). Falls back to
 * silence on platforms without Web Audio.
 */
export function getAudioManager(): AudioManager {
  if (!shared) {
    const web = new WebAudioBackend();
    shared = new AudioManager({ backend: web.supported ? web : new NullBackend() });
  }
  return shared;
}

/** Forget the shared engine (tests only). */
export function resetAudioManagerForTests(): void {
  shared?.dispose();
  shared = null;
}
