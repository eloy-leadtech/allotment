import { describe, it, expect } from 'vitest';
import {
  applyFades,
  biquad,
  crossfadeLoop,
  createRng,
  encodeWav,
  mixInto,
  normalize,
  parseWavHeader,
  peakOf,
  pinkNoise,
  reverb,
  rmsOf,
  whiteNoise,
} from './dsp';

const RATE = 22050;

/** Pure sine at `freq` Hz for `seconds`. */
function sine(freq: number, seconds: number, rate = RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i += 1) out[i] = Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

describe('createRng', () => {
  it('is deterministic per seed and stays in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('noise', () => {
  it('white noise is zero-mean-ish and bounded', () => {
    const n = whiteNoise(20000, createRng(7));
    expect(peakOf(n)).toBeLessThanOrEqual(1);
    const mean = n.reduce((s, v) => s + v, 0) / n.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
  });

  it('pink noise carries more low-frequency energy than white', () => {
    const rng = createRng(3);
    const white = whiteNoise(40000, rng);
    const pink = pinkNoise(40000, createRng(3));
    const low = (x: Float32Array) => rmsOf(biquad(x, 'lowpass', 300, 0.7, RATE));
    const high = (x: Float32Array) => rmsOf(biquad(x, 'highpass', 6000, 0.7, RATE));
    expect(low(pink) / high(pink)).toBeGreaterThan(low(white) / high(white));
  });
});

describe('biquad', () => {
  it('low-pass passes a low tone and kills a high one', () => {
    const lowTone = rmsOf(biquad(sine(200, 0.5), 'lowpass', 1000, 0.7, RATE));
    const highTone = rmsOf(biquad(sine(8000, 0.5), 'lowpass', 1000, 0.7, RATE));
    expect(lowTone).toBeGreaterThan(0.6);
    expect(highTone).toBeLessThan(0.05);
  });

  it('high-pass is the mirror image', () => {
    const lowTone = rmsOf(biquad(sine(100, 0.5), 'highpass', 2000, 0.7, RATE));
    const highTone = rmsOf(biquad(sine(6000, 0.5), 'highpass', 2000, 0.7, RATE));
    expect(lowTone).toBeLessThan(0.05);
    expect(highTone).toBeGreaterThan(0.6);
  });

  it('band-pass keeps the centre frequency only', () => {
    const centre = rmsOf(biquad(sine(1500, 0.5), 'bandpass', 1500, 4, RATE));
    const off = rmsOf(biquad(sine(300, 0.5), 'bandpass', 1500, 4, RATE));
    expect(centre).toBeGreaterThan(0.5);
    expect(off).toBeLessThan(0.1);
  });
});

describe('helpers', () => {
  it('normalize scales the peak to the target', () => {
    const x = Float32Array.from([0.1, -0.4, 0.2]);
    normalize(x, 0.8);
    expect(peakOf(x)).toBeCloseTo(0.8, 5);
  });

  it('normalize leaves silence alone', () => {
    const x = new Float32Array(10);
    normalize(x, 0.8);
    expect(peakOf(x)).toBe(0);
  });

  it('applyFades zeroes both edges (no clicks at the cut)', () => {
    const x = new Float32Array(1000).fill(1);
    applyFades(x, 0.005, 0.005, RATE);
    expect(x[0]).toBe(0);
    expect(x[x.length - 1]).toBeCloseTo(0, 1);
    expect(x[500]).toBe(1);
  });

  it('mixInto adds with offset and gain, ignoring what falls past the end', () => {
    const dest = new Float32Array(5);
    mixInto(dest, Float32Array.from([1, 1, 1, 1]), 3, 0.5);
    expect(Array.from(dest)).toEqual([0, 0, 0, 0.5, 0.5]);
  });
});

describe('reverb', () => {
  const impulse = (): Float32Array => {
    const x = new Float32Array(RATE);
    x[0] = 1;
    return x;
  };

  it('with no wet signal it returns the input untouched', () => {
    const x = whiteNoise(2000, createRng(5));
    expect(Array.from(reverb(x, RATE, { wet: 0 }))).toEqual(Array.from(x));
  });

  it('adds a decaying tail after an impulse', () => {
    const out = reverb(impulse(), RATE, { wet: 0.5, decay: 0.8 });
    const early = rmsOf(out.subarray(Math.round(RATE * 0.05), Math.round(RATE * 0.3)));
    const late = rmsOf(out.subarray(Math.round(RATE * 0.7), RATE));
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
    expect(peakOf(out)).toBeLessThan(2);
  });

  it('can extend the buffer so the tail is not cut off', () => {
    const out = reverb(impulse(), RATE, { wet: 0.5, tailSec: 0.5 });
    expect(out.length).toBe(RATE + Math.round(RATE * 0.5));
  });
});

describe('crossfadeLoop', () => {
  it('returns a shorter buffer whose seam is continuous', () => {
    const rng = createRng(11);
    const raw = pinkNoise(RATE * 3, rng);
    const overlap = RATE / 2;
    const loop = crossfadeLoop(raw, overlap);
    expect(loop.length).toBe(raw.length - overlap);
    // The jump from the last sample back to the first is no bigger than the
    // typical sample-to-sample step: nothing audible at the loop point.
    const seam = Math.abs(loop[loop.length - 1]! - loop[0]!);
    let stepSum = 0;
    for (let i = 1; i < loop.length; i += 1) stepSum += Math.abs(loop[i]! - loop[i - 1]!);
    const typicalStep = stepSum / (loop.length - 1);
    expect(seam).toBeLessThan(typicalStep * 4);
  });

  it('rejects an overlap longer than the audio', () => {
    expect(() => crossfadeLoop(new Float32Array(100), 100)).toThrow();
  });
});

describe('encodeWav / parseWavHeader', () => {
  it('writes a canonical 16-bit mono PCM header', () => {
    const wav = encodeWav(Float32Array.from([0, 0.5, -0.5, 1]), RATE);
    expect(wav.length).toBe(44 + 4 * 2);
    const header = parseWavHeader(wav);
    expect(header).toEqual({
      channels: 1,
      sampleRate: RATE,
      bitsPerSample: 16,
      frames: 4,
      durationSec: 4 / RATE,
    });
  });

  it('quantises and clips to int16', () => {
    const wav = encodeWav(Float32Array.from([2, -2, 0.5]), RATE);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(Math.round(0.5 * 32767));
  });

  it('refuses things that are not WAV', () => {
    expect(() => parseWavHeader(new Uint8Array(64))).toThrow();
    expect(() => parseWavHeader(new Uint8Array(10))).toThrow();
  });
});
