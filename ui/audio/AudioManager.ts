import { NullBackend, type AudioBackend, type Voice } from './backend';
import { SOUNDS, SOUND_IDS, soundUrl, type SoundId } from './catalog';
import type { SoundPlayer } from './player';
import {
  browserStorage,
  clampVolume,
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
  type ReadableStorage,
  type WritableStorage,
} from './settings';

/** A sound requested while its file downloads still plays if the file lands within this long. */
const LATE_PLAY_MS = 1000;

export interface AudioManagerOptions {
  backend?: AudioBackend;
  /** Where the preference is remembered. `null` = nowhere; omitted = localStorage. */
  storage?: (ReadableStorage & WritableStorage) | null;
  /** Vite base the sound files are served under (defaults to the app's). */
  baseUrl?: string;
  /** Clock in ms, injectable for tests. */
  now?: () => number;
}

/**
 * The game's single sound engine facade: owns the volume/mute preference
 * (persisted), preloads the catalogue, plays one-shots and holds ambience loops.
 * The platform specifics live behind `AudioBackend`, so this class is plain,
 * deterministic logic.
 *
 * It is deliberately forgiving: a sound is garnish, so every failure path (no
 * audio support, a download that fails, a browser that refuses to start audio)
 * degrades to silence instead of throwing.
 */
export class AudioManager implements SoundPlayer {
  private settings: AudioSettings;
  private readonly backend: AudioBackend;
  private readonly storage: (ReadableStorage & WritableStorage) | null;
  private readonly baseUrl: string | undefined;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();

  private unlocked = false;
  private unlocking: Promise<void> | null = null;

  /** Loops that should be running (id → fade-in ms), whether or not they started yet. */
  private readonly wantedLoops = new Map<SoundId, number>();
  private readonly loopVoices = new Map<SoundId, Voice>();
  private readonly lastPlayed = new Map<SoundId, number>();

  private readonly fetched = new Set<SoundId>();
  private readonly fetching = new Map<SoundId, Promise<void>>();
  /** Sounds whose download was postponed because the game is muted. */
  private pendingPreload: SoundId[] = [];

  constructor(options: AudioManagerOptions = {}) {
    this.backend = options.backend ?? new NullBackend();
    this.storage = options.storage === undefined ? browserStorage() : options.storage;
    this.baseUrl = options.baseUrl;
    this.now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.settings = loadAudioSettings(this.storage);
    this.applyMasterVolume();
  }

  /** Whether this platform can produce sound at all. */
  get supported(): boolean {
    return this.backend.supported;
  }

  // ───────────────────────────────────────────── preference

  /** Immutable snapshot; a new object is handed out whenever something changes. */
  getSettings(): AudioSettings {
    return this.settings;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setVolume(volume: number): void {
    this.update({ volume: clampVolume(volume) });
  }

  setMuted(muted: boolean): void {
    this.update({ muted });
  }

  toggleMuted(): void {
    this.setMuted(!this.settings.muted);
  }

  private update(change: Partial<AudioSettings>): void {
    const next: AudioSettings = {
      volume: change.volume ?? this.settings.volume,
      muted: change.muted ?? this.settings.muted,
    };
    if (next.volume === this.settings.volume && next.muted === this.settings.muted) return;
    this.settings = next;
    this.applyMasterVolume();
    saveAudioSettings(next, this.storage);
    for (const listener of [...this.listeners]) listener();
    if (!next.muted && this.pendingPreload.length > 0) {
      const ids = this.pendingPreload;
      this.pendingPreload = [];
      void this.preload(ids);
    }
  }

  private applyMasterVolume(): void {
    this.backend.setMasterVolume(this.settings.muted ? 0 : this.settings.volume);
  }

  // ───────────────────────────────────────────── engine lifecycle

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Wake the audio engine. Browsers only allow it from a user gesture, so call
   * this from a click/key/touch handler. Idempotent; if the browser refuses, the
   * manager just stays locked and the next gesture can try again.
   */
  unlock(): Promise<void> {
    if (this.unlocked) return Promise.resolve();
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.wake().finally(() => {
      this.unlocking = null;
    });
    return this.unlocking;
  }

  private wake(): Promise<void> {
    let waking: Promise<void>;
    try {
      // Called synchronously so it still counts as part of the user gesture.
      waking = this.backend.resume();
    } catch (err) {
      waking = Promise.reject(err);
    }
    return waking.then(
      () => {
        this.unlocked = true;
        this.reconcileLoops();
      },
      () => {
        /* refused (autoplay policy): stay locked and retry on the next gesture */
      },
    );
  }

  /** Park the engine while the page is hidden. */
  async suspend(): Promise<void> {
    if (!this.unlocked) return;
    try {
      await this.backend.suspend();
    } catch {
      /* nothing to do */
    }
  }

  /** Wake the engine again after `suspend()` (no gesture needed once unlocked). */
  async resume(): Promise<void> {
    if (!this.unlocked) return;
    try {
      await this.backend.resume();
      this.reconcileLoops();
    } catch {
      /* nothing to do */
    }
  }

  /** Release everything (used on unmount). */
  dispose(): void {
    this.wantedLoops.clear();
    for (const voice of this.loopVoices.values()) voice.stop();
    this.loopVoices.clear();
    this.listeners.clear();
    this.backend.dispose();
  }

  // ───────────────────────────────────────────── loading

  /**
   * Download sounds ahead of time so they fire instantly. Needs no gesture. While
   * the game is muted nothing is fetched; it catches up when sound is switched on.
   */
  async preload(ids: readonly SoundId[] = SOUND_IDS): Promise<void> {
    if (!this.backend.supported) return;
    if (this.settings.muted) {
      this.pendingPreload = [...new Set([...this.pendingPreload, ...ids])];
      return;
    }
    await Promise.all(ids.map((id) => this.fetchOnce(id)));
  }

  private fetchOnce(id: SoundId): Promise<void> {
    if (this.fetched.has(id)) return Promise.resolve();
    const inflight = this.fetching.get(id);
    if (inflight) return inflight;
    const request = this.backend
      .prefetch(id, soundUrl(id, this.baseUrl))
      .then(
        (ok) => {
          if (ok) this.fetched.add(id);
        },
        () => {
          /* a missing file only means that sound stays silent */
        },
      )
      .finally(() => {
        this.fetching.delete(id);
      });
    this.fetching.set(id, request);
    return request;
  }

  // ───────────────────────────────────────────── playback

  play(id: SoundId, options: { gain?: number } = {}): void {
    const def = SOUNDS[id];
    if (!def || def.loop) return;
    if (!this.backend.supported) return;
    if (this.settings.muted || this.settings.volume === 0) return;
    const t = this.now();
    const last = this.lastPlayed.get(id);
    if (last !== undefined && t - last < def.minGapMs) return;
    this.lastPlayed.set(id, t);

    const download = this.fetching.get(id);
    if (download) {
      // Still on its way (first moments of the page, or just unmuted): play it the
      // instant it lands, unless that is so late it would no longer make sense.
      void download.then(() => {
        if (this.now() - t <= LATE_PLAY_MS && !this.settings.muted) this.fire(id, options.gain);
      });
      return;
    }
    this.fire(id, options.gain);
  }

  private fire(id: SoundId, gain = 1): void {
    try {
      this.backend.play(id, { gain: SOUNDS[id].gain * gain, loop: false });
    } catch {
      /* a sound must never break the game */
    }
  }

  startLoop(id: SoundId, fadeMs = 0): void {
    if (!SOUNDS[id]?.loop) return;
    this.wantedLoops.set(id, fadeMs);
    this.reconcileLoops();
  }

  stopLoop(id: SoundId, fadeMs = 0): void {
    this.wantedLoops.delete(id);
    const voice = this.loopVoices.get(id);
    if (!voice) return;
    this.loopVoices.delete(id);
    try {
      voice.stop(fadeMs);
    } catch {
      /* already gone */
    }
  }

  /** Start any wanted loop that is not running yet (the engine may only now be ready). */
  private reconcileLoops(): void {
    if (!this.unlocked || !this.backend.supported) return;
    for (const [id, fadeMs] of this.wantedLoops) {
      if (this.loopVoices.has(id)) continue;
      try {
        const voice = this.backend.play(id, {
          gain: SOUNDS[id].gain,
          loop: true,
          fadeInMs: fadeMs > 0 ? fadeMs : undefined,
        });
        if (voice) this.loopVoices.set(id, voice);
      } catch {
        /* retried on the next reconcile */
      }
    }
  }
}
