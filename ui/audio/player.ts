import type { SoundId } from './catalog';

/**
 * The slice of the sound engine that the rest of the UI is allowed to use:
 * fire a cue, hold an ambience loop, wake the engine on a user gesture. The
 * AudioManager implements it; tests and screens can stand in anything shaped like it.
 */
export interface SoundPlayer {
  /** Play a one-shot. Fire-and-forget: never throws, silent if muted/unavailable. */
  play(id: SoundId, options?: { gain?: number }): void;
  /** Keep a looping sound running until `stopLoop`. No-op for non-looping sounds. */
  startLoop(id: SoundId, fadeMs?: number): void;
  stopLoop(id: SoundId, fadeMs?: number): void;
  /** Wake the engine; call it from a user gesture. Idempotent. */
  unlock(): Promise<void>;
  isUnlocked(): boolean;
}
