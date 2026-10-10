/**
 * Test doubles for the audio layer. Not imported by the app: only by tests.
 */
import type { AudioBackend, PlayOptions, Voice } from './backend';
import type { SoundId } from './catalog';
import type { SoundPlayer } from './player';

export class FakeVoice implements Voice {
  /** Fade (ms) of every stop() call, in order; `undefined` = a hard stop. */
  stops: Array<number | undefined> = [];
  stop(fadeMs?: number): void {
    this.stops.push(fadeMs);
  }
  get stopped(): boolean {
    return this.stops.length > 0;
  }
}

export interface FakePlay extends PlayOptions {
  key: string;
  voice: FakeVoice;
}

/** An in-memory engine that records what it was asked to do. */
export class FakeBackend implements AudioBackend {
  supported = true;
  /** Becomes true on resume(): emulates "the audio context exists and runs". */
  running = false;
  prefetched: Array<{ key: string; url: string }> = [];
  plays: FakePlay[] = [];
  master = 1;
  resumeCalls = 0;
  suspendCalls = 0;
  disposed = false;

  prefetch(key: string, url: string): Promise<boolean> {
    this.prefetched.push({ key, url });
    return Promise.resolve(true);
  }
  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.running = true;
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls += 1;
    return Promise.resolve();
  }
  play(key: string, options: PlayOptions): Voice | null {
    if (!this.running) return null;
    const voice = new FakeVoice();
    this.plays.push({ key, voice, ...options });
    return voice;
  }
  setMasterVolume(volume: number): void {
    this.master = volume;
  }
  dispose(): void {
    this.disposed = true;
  }
  /** Keys played so far, in order. */
  get played(): string[] {
    return this.plays.map((p) => p.key);
  }
}

/** A SoundPlayer that only records the cues it receives. */
export class FakePlayer implements SoundPlayer {
  cues: string[] = [];
  loopsStarted: string[] = [];
  loopsStopped: string[] = [];
  unlocked = false;
  unlockCalls = 0;
  play(id: SoundId): void {
    this.cues.push(id);
  }
  startLoop(id: SoundId): void {
    this.loopsStarted.push(id);
  }
  stopLoop(id: SoundId): void {
    this.loopsStopped.push(id);
  }
  unlock(): Promise<void> {
    this.unlockCalls += 1;
    this.unlocked = true;
    return Promise.resolve();
  }
  isUnlocked(): boolean {
    return this.unlocked;
  }
}
