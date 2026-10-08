/**
 * What the AudioManager needs from a sound engine. The real implementation sits
 * on the Web Audio API (`WebAudioBackend`); tests plug in a fake, and platforms
 * without audio get the silent `NullBackend`.
 */
export interface Voice {
  /** Stop the sound, optionally fading it out over `fadeMs`. Safe to call twice. */
  stop(fadeMs?: number): void;
}

export interface PlayOptions {
  /** Linear gain 0..1 for this voice (the master volume applies on top). */
  gain: number;
  loop: boolean;
  /** Fade the voice in over this many ms (used by ambience loops). */
  fadeInMs?: number;
}

export interface AudioBackend {
  /** False where no audio can ever be produced (jsdom, SSR, ancient WebViews). */
  readonly supported: boolean;
  /**
   * Download a sound's bytes. Needs no audio context, so it can run before the
   * first user gesture. Resolves true when the sound is available.
   */
  prefetch(key: string, url: string): Promise<boolean>;
  /**
   * Create/wake the audio engine. Browsers only allow this inside a user gesture
   * the first time. Resolves once the engine is running.
   */
  resume(): Promise<void>;
  /** Park the engine (tab hidden) to save battery. */
  suspend(): Promise<void>;
  /**
   * Start a prefetched sound. Returns null when it cannot play right now (engine
   * not running, unknown key): the caller just drops the sound.
   */
  play(key: string, options: PlayOptions): Voice | null;
  /** Master gain 0..1 applied to every voice, including ones already playing. */
  setMasterVolume(volume: number): void;
  /** Release everything. */
  dispose(): void;
}

/** Silent backend for environments with no audio at all. */
export class NullBackend implements AudioBackend {
  readonly supported = false;
  prefetch(): Promise<boolean> {
    return Promise.resolve(false);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    return Promise.resolve();
  }
  play(): Voice | null {
    return null;
  }
  setMasterVolume(): void {}
  dispose(): void {}
}
