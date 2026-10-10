import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebAudioBackend } from './WebAudioBackend';

// ─── A hand-rolled Web Audio double: just enough surface for the backend. ───

class FakeParam {
  value = 1;
  calls: Array<[string, ...number[]]> = [];
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    this.calls.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.calls.push(['ramp', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    this.value = v;
    this.calls.push(['target', v, t, tc]);
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.calls.push(['cancel', t]);
    return this;
  }
}

class FakeNode {
  connectedTo: FakeNode[] = [];
  connect(node: FakeNode): FakeNode {
    this.connectedTo.push(node);
    return node;
  }
  disconnect(): void {
    this.connectedTo = [];
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  started = false;
  stoppedAt: number | undefined;
  onended: (() => void) | null = null;
  start(): void {
    this.started = true;
  }
  stop(when?: number): void {
    this.stoppedAt = when ?? 0;
  }
}

class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 10;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  decodeCalls = 0;
  refuseToStart = false;
  failDecode = false;
  /** When true, decodeAudioData stays pending until `releaseDecodes()`. */
  holdDecode = false;
  private held: Array<() => void> = [];
  releaseDecodes(): void {
    for (const release of this.held.splice(0)) release();
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  decodeAudioData(_bytes: ArrayBuffer): Promise<{ id: number }> {
    this.decodeCalls += 1;
    if (this.failDecode) return Promise.reject(new Error('EncodingError'));
    const result = { id: this.decodeCalls };
    if (this.holdDecode) {
      return new Promise((resolve) => this.held.push(() => resolve(result)));
    }
    return Promise.resolve(result);
  }
  resume(): Promise<void> {
    if (this.refuseToStart) return new Promise<void>(() => {});
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** A fetch that serves `bytes` bytes for every URL, or fails per `ok`. */
function fakeFetch(ok = true) {
  return vi.fn((_url: string) =>
    Promise.resolve({ ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) } as Response),
  );
}

/** Let pending promise callbacks run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

interface Rig {
  ctx: FakeContext;
  backend: WebAudioBackend;
  fetchFn: ReturnType<typeof fakeFetch>;
}

function rig(): Rig {
  const ctx = new FakeContext();
  const fetchFn = fakeFetch();
  const backend = new WebAudioBackend({
    createContext: () => ctx as unknown as AudioContext,
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  return { ctx, backend, fetchFn };
}

/** The master gain: the node every voice ends up connected to. */
const masterOf = (ctx: FakeContext): FakeGain => ctx.gains[0]!;

describe('WebAudioBackend support', () => {
  it('reports no support where there is no AudioContext (jsdom)', () => {
    expect(new WebAudioBackend().supported).toBe(false);
  });

  it('reports support when a context can be created', () => {
    expect(rig().backend.supported).toBe(true);
  });

  it('refuses to resume where there is nothing to resume', async () => {
    await expect(new WebAudioBackend().resume()).rejects.toThrow();
    expect(new WebAudioBackend().play('x', { gain: 1, loop: false })).toBeNull();
  });
});

describe('WebAudioBackend.prefetch', () => {
  it('downloads each sound once and reports success', async () => {
    const { backend, fetchFn } = rig();
    expect(await backend.prefetch('click', '/sfx/click.wav')).toBe(true);
    expect(await backend.prefetch('click', '/sfx/click.wav')).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/sfx/click.wav');
  });

  it('shares an in-flight download between concurrent requests', async () => {
    const { backend, fetchFn } = rig();
    await Promise.all([
      backend.prefetch('click', '/sfx/click.wav'),
      backend.prefetch('click', '/sfx/click.wav'),
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reports failure for an HTTP error or a network error, and can retry', async () => {
    const ctx = new FakeContext();
    const responses = [
      () => Promise.resolve({ ok: false } as Response),
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) } as Response),
    ];
    const fetchFn = vi.fn(() => responses.shift()!());
    const backend = new WebAudioBackend({
      createContext: () => ctx as unknown as AudioContext,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await backend.prefetch('click', '/x')).toBe(false);
    expect(await backend.prefetch('click', '/x')).toBe(false);
    expect(await backend.prefetch('click', '/x')).toBe(true);
  });
});

describe('WebAudioBackend.resume', () => {
  it('creates the context on first use and routes a master gain to the speakers', async () => {
    const { backend, ctx } = rig();
    await backend.resume();
    expect(ctx.state).toBe('running');
    expect(masterOf(ctx).connectedTo).toEqual([ctx.destination]);
  });

  it('gives up if the browser never lets the context start, so a later gesture can retry', async () => {
    vi.useFakeTimers();
    try {
      const { backend, ctx } = rig();
      ctx.refuseToStart = true;
      const attempt = backend.resume();
      const outcome = attempt.then(
        () => 'resolved',
        () => 'rejected',
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(await outcome).toBe('rejected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('decodes what was downloaded so the first sound has no delay', async () => {
    const { backend, ctx } = rig();
    await backend.prefetch('click', '/sfx/click.wav');
    await backend.resume();
    await flush();
    expect(ctx.decodeCalls).toBe(1);
  });
});

describe('WebAudioBackend decoding', () => {
  it('decodes a sound as soon as it lands when the engine is already awake', async () => {
    const { backend, ctx } = rig();
    await backend.resume();
    expect(ctx.decodeCalls).toBe(0);
    await backend.prefetch('goal', '/sfx/goal.wav');
    await flush();
    expect(ctx.decodeCalls).toBe(1);
    // ...so the first play starts at once, with no second decode.
    backend.play('goal', { gain: 1, loop: false });
    expect(ctx.sources.filter((s) => s.started)).toHaveLength(1);
    expect(ctx.decodeCalls).toBe(1);
  });

  it('waits for the engine to wake before decoding anything', async () => {
    const { backend, ctx } = rig();
    await backend.prefetch('goal', '/sfx/goal.wav');
    await flush();
    expect(ctx.decodeCalls).toBe(0);
  });
});

describe('WebAudioBackend.play', () => {
  let r: Rig;
  beforeEach(async () => {
    r = rig();
    await r.backend.prefetch('goal', '/sfx/goal.wav');
    await r.backend.prefetch('crowd', '/sfx/crowd.wav');
  });

  it('plays nothing before the engine runs', () => {
    expect(r.backend.play('goal', { gain: 1, loop: false })).toBeNull();
  });

  it('plays nothing for a sound that was never downloaded', async () => {
    await r.backend.resume();
    expect(r.backend.play('nope', { gain: 1, loop: false })).toBeNull();
  });

  it('plays nothing if the context is not actually running', async () => {
    await r.backend.resume();
    r.ctx.state = 'suspended';
    expect(r.backend.play('goal', { gain: 1, loop: false })).toBeNull();
  });

  it('starts a source wired source → voice gain → master → speakers', async () => {
    await r.backend.resume();
    const voice = r.backend.play('goal', { gain: 0.6, loop: false });
    expect(voice).not.toBeNull();
    await flush();
    const [source] = r.ctx.sources;
    expect(source?.started).toBe(true);
    expect(source?.loop).toBe(false);
    const voiceGain = r.ctx.gains[1]!;
    expect(voiceGain.gain.value).toBeCloseTo(0.6);
    expect(source?.connectedTo).toEqual([voiceGain]);
    expect(voiceGain.connectedTo).toEqual([masterOf(r.ctx)]);
  });

  it('decodes a sound only once however often it plays', async () => {
    await r.backend.resume();
    await flush();
    r.backend.play('goal', { gain: 1, loop: false });
    r.backend.play('goal', { gain: 1, loop: false });
    await flush();
    expect(r.ctx.sources).toHaveLength(2);
    expect(r.ctx.decodeCalls).toBe(2); // goal + crowd (decoded on resume), never again
  });

  it('loops and fades in when asked', async () => {
    await r.backend.resume();
    r.backend.play('crowd', { gain: 0.4, loop: true, fadeInMs: 1000 });
    await flush();
    expect(r.ctx.sources[0]?.loop).toBe(true);
    const params = r.ctx.gains[1]!.gain;
    expect(params.calls).toContainEqual(['set', 0, 10]);
    expect(params.calls).toContainEqual(['ramp', 0.4, 11]);
  });

  it('stops hard, or fades out and stops just after the fade', async () => {
    await r.backend.resume();
    const hard = r.backend.play('goal', { gain: 1, loop: false });
    const soft = r.backend.play('crowd', { gain: 1, loop: true });
    await flush();
    hard?.stop();
    soft?.stop(500);
    expect(r.ctx.sources[0]?.stoppedAt).toBe(0);
    expect(r.ctx.sources[1]?.stoppedAt).toBeCloseTo(10.52);
    expect(r.ctx.gains[2]!.gain.calls).toContainEqual(['ramp', 0, 10.5]);
  });

  it('cancels a sound stopped before its decode finished', async () => {
    const fresh = rig();
    fresh.ctx.holdDecode = true;
    await fresh.backend.prefetch('goal', '/sfx/goal.wav');
    await fresh.backend.resume();
    const voice = fresh.backend.play('goal', { gain: 1, loop: false });
    expect(voice).not.toBeNull();
    voice?.stop();
    voice?.stop();
    fresh.ctx.releaseDecodes();
    await flush();
    expect(fresh.ctx.sources.filter((s) => s.started)).toHaveLength(0);
  });

  it('starts a sound whose decode finishes while it is still wanted', async () => {
    const fresh = rig();
    fresh.ctx.holdDecode = true;
    await fresh.backend.prefetch('goal', '/sfx/goal.wav');
    await fresh.backend.resume();
    fresh.backend.play('goal', { gain: 1, loop: false });
    expect(fresh.ctx.sources).toHaveLength(0);
    fresh.ctx.releaseDecodes();
    await flush();
    expect(fresh.ctx.sources.filter((s) => s.started)).toHaveLength(1);
  });

  it('survives a file that cannot be decoded', async () => {
    await r.backend.resume();
    await flush();
    r.ctx.failDecode = true;
    await r.backend.prefetch('card', '/sfx/card.wav');
    expect(() => r.backend.play('card', { gain: 1, loop: false })).not.toThrow();
    await flush();
    expect(r.backend.play('card', { gain: 1, loop: false })).toBeNull();
  });

  it('cleans its nodes up when a sound ends by itself', async () => {
    await r.backend.resume();
    r.backend.play('goal', { gain: 1, loop: false });
    await flush();
    const source = r.ctx.sources[0]!;
    source.onended?.();
    expect(source.connectedTo).toEqual([]);
    expect(r.ctx.gains[1]!.connectedTo).toEqual([]);
  });
});

describe('WebAudioBackend master volume and lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('remembers a volume set before the context exists', async () => {
    const { backend, ctx } = rig();
    backend.setMasterVolume(0.25);
    await backend.resume();
    expect(masterOf(ctx).gain.value).toBeCloseTo(0.25);
  });

  it('changes the volume smoothly once running', async () => {
    const { backend, ctx } = rig();
    await backend.resume();
    backend.setMasterVolume(0);
    expect(masterOf(ctx).gain.value).toBe(0);
    expect(masterOf(ctx).gain.calls.some(([kind]) => kind === 'target')).toBe(true);
  });

  it('suspends a running context and ignores suspend when there is none', async () => {
    const { backend, ctx } = rig();
    await expect(backend.suspend()).resolves.toBeUndefined();
    await backend.resume();
    await backend.suspend();
    expect(ctx.state).toBe('suspended');
  });

  it('closes the context on dispose and then refuses to play', async () => {
    const { backend, ctx } = rig();
    await backend.prefetch('goal', '/x');
    await backend.resume();
    backend.dispose();
    expect(ctx.state).toBe('closed');
    expect(backend.play('goal', { gain: 1, loop: false })).toBeNull();
  });
});
