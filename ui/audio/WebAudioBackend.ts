import type { AudioBackend, PlayOptions, Voice } from './backend';

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

/** The browser's AudioContext constructor (with the old WebKit prefix), if any. */
function nativeContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface WebAudioEnv {
  /** Context factory, injectable for tests. */
  createContext?: () => AudioContext | null;
  fetchFn?: typeof fetch;
}

/** How long to wait for a browser that has not (yet) agreed to start audio. */
const START_TIMEOUT_MS = 1500;

/**
 * Sound engine on top of the Web Audio API: sounds are downloaded as bytes first
 * (no context needed, so it can happen before the first gesture), decoded once
 * when the context exists, and then started as cheap one-shot buffer sources.
 * That gives instant, overlapping clicks and sample-accurate ambience loops,
 * which HTMLAudio cannot.
 *
 * Signal path: source → per-voice gain → master gain → speakers.
 */
export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVolume = 1;

  private readonly bytes = new Map<string, ArrayBuffer>();
  private readonly decoded = new Map<string, AudioBuffer>();
  private readonly downloads = new Map<string, Promise<boolean>>();
  private readonly decoding = new Map<string, Promise<AudioBuffer | null>>();

  constructor(private readonly env: WebAudioEnv = {}) {}

  get supported(): boolean {
    return this.env.createContext !== undefined || nativeContextCtor() !== null;
  }

  prefetch(key: string, url: string): Promise<boolean> {
    if (this.bytes.has(key) || this.decoded.has(key) || this.decoding.has(key)) {
      return Promise.resolve(true);
    }
    const inflight = this.downloads.get(key);
    if (inflight) return inflight;
    const fetchFn = this.env.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetchFn) return Promise.resolve(false);
    const job = this.download(fetchFn, key, url).finally(() => {
      this.downloads.delete(key);
    });
    this.downloads.set(key, job);
    return job;
  }

  private async download(fetchFn: typeof fetch, key: string, url: string): Promise<boolean> {
    try {
      const response = await fetchFn(url);
      if (!response.ok) return false;
      this.bytes.set(key, await response.arrayBuffer());
      // Engine already awake (the rest of the pack lands after the first click):
      // decode now, so the first play of this sound has no delay.
      if (this.ctx) void this.decode(key);
      return true;
    } catch {
      return false;
    }
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) throw new Error('Web Audio is not available');
    if (ctx.state !== 'running') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const gaveUp = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, START_TIMEOUT_MS);
      });
      try {
        await Promise.race([ctx.resume(), gaveUp]);
      } finally {
        clearTimeout(timer);
      }
    }
    if (ctx.state !== 'running') throw new Error('The audio context did not start');
    // Decode whatever has been downloaded so the very first sounds have no delay.
    for (const key of [...this.bytes.keys()]) void this.decode(key);
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  play(key: string, options: PlayOptions): Voice | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return null;
    if (!this.decoded.has(key) && !this.decoding.has(key) && !this.bytes.has(key)) return null;

    let stopped = false;
    let live: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

    const start = (buffer: AudioBuffer): void => {
      if (stopped) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      if (options.fadeInMs && options.fadeInMs > 0) {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(options.gain, now + options.fadeInMs / 1000);
      } else {
        gain.gain.setValueAtTime(options.gain, now);
      }
      source.connect(gain);
      gain.connect(master);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      live = { source, gain };
    };

    const ready = this.decoded.get(key);
    if (ready) start(ready);
    else void this.decode(key).then((buffer) => buffer && start(buffer));

    return {
      stop: (fadeMs = 0) => {
        if (stopped) return;
        stopped = true;
        if (!live) return; // still decoding: the pending start is now cancelled
        const { source, gain } = live;
        const now = ctx.currentTime;
        if (fadeMs > 0) {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
          source.stop(now + fadeMs / 1000 + 0.02);
        } else {
          source.stop();
        }
      },
    };
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.ctx && this.master) {
      // A short ramp instead of a jump, so dragging the slider never clicks.
      this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
    }
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.bytes.clear();
    this.decoded.clear();
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    let ctx: AudioContext | null = null;
    if (this.env.createContext) {
      ctx = this.env.createContext();
    } else {
      const Ctor = nativeContextCtor();
      if (Ctor) ctx = new Ctor({ latencyHint: 'interactive' });
    }
    if (!ctx) return null;
    const master = ctx.createGain();
    master.gain.value = this.masterVolume;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    return ctx;
  }

  private decode(key: string): Promise<AudioBuffer | null> {
    const ready = this.decoded.get(key);
    if (ready) return Promise.resolve(ready);
    const inflight = this.decoding.get(key);
    if (inflight) return inflight;
    const ctx = this.ctx;
    const bytes = this.bytes.get(key);
    if (!ctx || !bytes) return Promise.resolve(null);
    const job = ctx
      .decodeAudioData(bytes)
      .then(
        (buffer) => {
          this.decoded.set(key, buffer);
          this.bytes.delete(key);
          return buffer;
        },
        () => {
          this.bytes.delete(key); // undecodable: that sound simply stays silent
          return null;
        },
      )
      .finally(() => {
        this.decoding.delete(key);
      });
    this.decoding.set(key, job);
    return job;
  }
}
