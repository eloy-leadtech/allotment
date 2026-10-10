/**
 * Tiny dependency-free DSP toolkit used to synthesise the game's sound effects
 * offline (see `generate.ts`). Everything is plain maths on Float32Array and is
 * deterministic: the same seed always renders the same samples, so the shipped
 * WAV files can be regenerated and audited. Nothing here touches the browser.
 */

/** Deterministic PRNG (mulberry32): a function returning floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform white noise in [-1, 1). */
export function whiteNoise(length: number, rng: () => number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = rng() * 2 - 1;
  return out;
}

/** Pink-ish (1/f) noise via Paul Kellet's economy filter; roughly within [-1, 1]. */
export function pinkNoise(length: number, rng: () => number): Float32Array {
  const out = new Float32Array(length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = rng() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
  }
  return out;
}

export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

/**
 * Second-order IIR filter (RBJ cookbook), streaming so its cutoff can move while
 * it runs. `bandpass` has constant 0 dB peak gain.
 */
export class Biquad {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly kind: FilterKind,
    freq: number,
    q: number,
    private readonly rate: number,
  ) {
    this.set(freq, q);
  }

  /** Retune without resetting the filter memory (no clicks). */
  set(freq: number, q: number): void {
    const f = Math.min(Math.max(freq, 10), this.rate * 0.45);
    const w0 = (2 * Math.PI * f) / this.rate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(q, 0.05));
    let b0: number;
    let b1: number;
    let b2: number;
    switch (this.kind) {
      case 'lowpass':
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = (1 - cos) / 2;
        break;
      case 'highpass':
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = (1 + cos) / 2;
        break;
      case 'bandpass':
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        break;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Filter a whole buffer with a fixed biquad. Returns a new buffer. */
export function biquad(
  input: Float32Array,
  kind: FilterKind,
  freq: number,
  q: number,
  rate: number,
): Float32Array {
  const f = new Biquad(kind, freq, q, rate);
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = f.process(input[i] ?? 0);
  return out;
}

export function peakOf(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i += 1) p = Math.max(p, Math.abs(x[i] ?? 0));
  return p;
}

export function rmsOf(x: Float32Array): number {
  if (x.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i += 1) s += (x[i] ?? 0) ** 2;
  return Math.sqrt(s / x.length);
}

/** Scale in place so the highest absolute sample equals `target` (silence stays silent). */
export function normalize(x: Float32Array, target: number): void {
  const p = peakOf(x);
  if (p === 0) return;
  const k = target / p;
  for (let i = 0; i < x.length; i += 1) x[i] = (x[i] ?? 0) * k;
}

/** Linear fade-in/out in place, so a cut never ends on a click. */
export function applyFades(x: Float32Array, inSec: number, outSec: number, rate: number): void {
  const nIn = Math.round(inSec * rate);
  const nOut = Math.round(outSec * rate);
  for (let i = 0; i < nIn && i < x.length; i += 1) x[i] = (x[i] ?? 0) * (i / nIn);
  for (let i = 0; i < nOut && i < x.length; i += 1) {
    const j = x.length - 1 - i;
    x[j] = (x[j] ?? 0) * (i / nOut);
  }
}

/** Add `src` into `dest` starting at `offset` samples, scaled by `gain`. */
export function mixInto(dest: Float32Array, src: Float32Array, offset: number, gain = 1): void {
  for (let i = 0; i < src.length; i += 1) {
    const j = offset + i;
    if (j < 0) continue;
    if (j >= dest.length) break;
    dest[j] = (dest[j] ?? 0) + (src[i] ?? 0) * gain;
  }
}

export interface ReverbOptions {
  /** Share of the reverberated signal in the mix, 0 (dry) .. 1. Default 0.25. */
  wet?: number;
  /** Comb feedback, 0..0.95: longer tail the closer to 1. Default 0.82. */
  decay?: number;
  /** Seconds of silence appended so the tail rings out. Default 0. */
  tailSec?: number;
}

/**
 * Small Schroeder reverb (four parallel combs into two all-passes): just enough
 * room to turn a pile of voices into a stadium. Returns a new buffer.
 */
export function reverb(x: Float32Array, rate: number, opts: ReverbOptions = {}): Float32Array {
  const wet = opts.wet ?? 0.25;
  const feedback = Math.min(0.95, opts.decay ?? 0.82);
  const n = x.length + Math.round((opts.tailSec ?? 0) * rate);
  const dry = new Float32Array(n);
  dry.set(x);
  if (wet === 0) return dry;

  const combs = [29.7, 37.1, 41.1, 43.7].map((ms) => ({
    buf: new Float32Array(Math.max(1, Math.round((ms / 1000) * rate))),
    idx: 0,
  }));
  const allpasses = [5.0, 1.7].map((ms) => ({
    buf: new Float32Array(Math.max(1, Math.round((ms / 1000) * rate))),
    idx: 0,
  }));
  const g = 0.7;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const input = dry[i] ?? 0;
    let sum = 0;
    for (const c of combs) {
      const delayed = c.buf[c.idx] ?? 0;
      sum += delayed;
      c.buf[c.idx] = input + feedback * delayed;
      c.idx = (c.idx + 1) % c.buf.length;
    }
    let y = sum / combs.length;
    for (const a of allpasses) {
      const delayed = a.buf[a.idx] ?? 0;
      const v = y + g * delayed;
      a.buf[a.idx] = v;
      y = -g * v + delayed;
      a.idx = (a.idx + 1) % a.buf.length;
    }
    out[i] = input * (1 - wet) + y * wet * 2;
  }
  return out;
}

/**
 * Turn a longer render into a seamless loop: the last `overlap` samples are
 * equal-power-crossfaded into the first `overlap`. The result is `overlap`
 * samples shorter, and its last sample flows straight into its first one.
 */
export function crossfadeLoop(x: Float32Array, overlap: number): Float32Array {
  if (overlap <= 0 || overlap * 2 > x.length) {
    throw new Error('crossfadeLoop: overlap must be positive and at most half the audio');
  }
  const n = x.length - overlap;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = x[i] ?? 0;
  for (let i = 0; i < overlap; i += 1) {
    const a = Math.sin((Math.PI / 2) * (i / overlap));
    const b = Math.cos((Math.PI / 2) * (i / overlap));
    out[i] = (x[i] ?? 0) * a + (x[n + i] ?? 0) * b;
  }
  return out;
}

/** Encode mono float samples (-1..1) as a canonical 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const tag = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) out[offset + i] = s.charCodeAt(i);
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-32768, Math.min(32767, Math.round((samples[i] ?? 0) * 32767)));
    view.setInt16(44 + i * 2, v, true);
  }
  return out;
}

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
  durationSec: number;
}

/** Read the essentials of a PCM WAV file; throws if it is not one. */
export function parseWavHeader(bytes: Uint8Array): WavInfo {
  if (bytes.length < 44) throw new Error('WAV too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number): string =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a RIFF/WAVE file');
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataBytes = -1;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = tag(pos);
    const size = view.getUint32(pos + 4, true);
    if (id === 'fmt ') {
      channels = view.getUint16(pos + 10, true);
      sampleRate = view.getUint32(pos + 12, true);
      bitsPerSample = view.getUint16(pos + 22, true);
    } else if (id === 'data') {
      dataBytes = size;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (dataBytes < 0 || channels === 0) throw new Error('WAV is missing its fmt/data chunk');
  const frames = dataBytes / ((bitsPerSample / 8) * channels);
  return { channels, sampleRate, bitsPerSample, frames, durationSec: frames / sampleRate };
}
