/**
 * Recipes for the game's sound effects. Each one is built from oscillators,
 * filtered noise and envelopes (see `dsp.ts`) — no samples from any recording,
 * so every file in `public/sfx/` is an original work that can be regenerated
 * bit-for-bit with `npx tsx ui/audio/synth/generate.ts`.
 *
 * All sounds are normalised to the same peak; their relative loudness is set by
 * the `gain` of each entry in `../catalog.ts`.
 */
import {
  Biquad,
  applyFades,
  biquad,
  crossfadeLoop,
  createRng,
  mixInto,
  normalize,
  pinkNoise,
  reverb,
  rmsOf,
  whiteNoise,
} from './dsp';

/** Sample rate of the short effects (plenty for UI blips and whistles). */
export const SFX_RATE = 22050;
/** Ambience is all low/mid noise, so a lower rate halves the file for free. */
export const AMBIENCE_RATE = 16000;
/** Every file is normalised to this peak (about -1 dBFS). */
export const FILE_PEAK = 0.89;

const TAU = Math.PI * 2;

export interface RenderedSound {
  rate: number;
  samples: Float32Array;
}

/** Smooth 0..1 ramp (smoothstep). */
function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Additive "soft square": odd harmonics only, band-limited so it never aliases. */
function softSquare(phase: number, harmonics: number): number {
  let s = 0;
  for (let k = 1; k <= harmonics; k += 2) s += Math.sin(k * phase) / k;
  return s;
}

// ─────────────────────────────────────────────── UI

/** A soft "tick": a fast downward chirp plus a hair of high-passed noise. */
function renderClick(): RenderedSound {
  const rate = SFX_RATE;
  const n = Math.round(0.05 * rate);
  const out = new Float32Array(n);
  const noise = biquad(whiteNoise(n, createRng(101)), 'highpass', 2500, 0.7, rate);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    phase += (TAU * (900 + 1100 * Math.exp(-t / 0.006))) / rate;
    out[i] = Math.sin(phase) * Math.exp(-t / 0.009) * 0.8 + (noise[i] ?? 0) * Math.exp(-t / 0.0018) * 0.5;
  }
  applyFades(out, 0.0004, 0.008, rate);
  normalize(out, FILE_PEAK);
  return { rate, samples: out };
}

/** Two rising notes (E5 → B5): the "yes, done" blip of a primary action. */
function renderConfirm(): RenderedSound {
  const rate = SFX_RATE;
  const out = new Float32Array(Math.round(0.24 * rate));
  const note = (freq: number, startSec: number, lenSec: number, level: number): void => {
    const len = Math.round(lenSec * rate);
    const buf = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i += 1) {
      const t = i / rate;
      phase += (TAU * freq) / rate;
      buf[i] = softSquare(phase, 5) * Math.exp(-t / 0.05) * Math.min(1, t / 0.003);
    }
    mixInto(out, buf, Math.round(startSec * rate), level);
  };
  note(659.25, 0, 0.12, 0.7);
  note(987.77, 0.07, 0.16, 0.8);
  applyFades(out, 0.0004, 0.02, rate);
  normalize(out, FILE_PEAK);
  return { rate, samples: out };
}

// ─────────────────────────────────────────────── referee

interface BlastOptions {
  /** Fraction the pitch sags by at the very end (running out of breath). */
  endDrop?: number;
  seed: number;
}

/**
 * One blast of a pea whistle: a ~3 kHz tone with a little vibrato, the rattle of
 * the pea as a fast amplitude trill, a second and third partial, and breath noise.
 */
function whistleBlast(durationSec: number, f0: number, rate: number, opts: BlastOptions): Float32Array {
  const n = Math.round(durationSec * rate);
  const out = new Float32Array(n);
  const rng = createRng(opts.seed);
  const breath = new Biquad('bandpass', f0 * 1.1, 3, rate);
  const drop = opts.endDrop ?? 0;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const u = i / n;
    const onset = 1 - 0.05 * Math.exp(-t / 0.03); // the pitch climbs into place
    const sag = 1 - drop * smooth((u - 0.7) / 0.3);
    const vibrato = 1 + 0.008 * Math.sin(TAU * 5.2 * t);
    phase += (TAU * f0 * onset * sag * vibrato) / rate;
    const trill = 0.72 + 0.28 * Math.sin(TAU * 34 * t);
    const tone = Math.sin(phase) + 0.3 * Math.sin(2 * phase + 0.4) + 0.1 * Math.sin(3 * phase + 1.1);
    const air = breath.process(rng() * 2 - 1) * 0.4;
    const env = Math.min(1, t / 0.014) * Math.min(1, (n - 1 - i) / (0.05 * rate));
    out[i] = (tone * trill * 0.62 + air) * env;
  }
  return out;
}

/** One long blast: kick-off. */
function renderWhistleStart(): RenderedSound {
  const rate = SFX_RATE;
  const blast = whistleBlast(0.55, 2950, rate, { seed: 201, endDrop: 0.015 });
  const out = reverb(blast, rate, { wet: 0.14, decay: 0.7, tailSec: 0.25 });
  applyFades(out, 0.002, 0.05, rate);
  normalize(out, FILE_PEAK);
  return { rate, samples: out };
}

/** Short, short, long: full time. */
function renderWhistleEnd(): RenderedSound {
  const rate = SFX_RATE;
  const out = new Float32Array(Math.round(1.9 * rate));
  mixInto(out, whistleBlast(0.26, 2980, rate, { seed: 211 }), 0);
  mixInto(out, whistleBlast(0.26, 2980, rate, { seed: 212 }), Math.round(0.37 * rate));
  mixInto(out, whistleBlast(0.85, 2900, rate, { seed: 213, endDrop: 0.05 }), Math.round(0.74 * rate));
  const wet = reverb(out, rate, { wet: 0.14, decay: 0.7, tailSec: 0.25 });
  applyFades(wet, 0.002, 0.05, rate);
  normalize(wet, FILE_PEAK);
  return { rate, samples: wet };
}

/** The crisp "fwip" of a card being pulled and flicked up. */
function cardFlick(rate: number, seed: number): Float32Array {
  const n = Math.round(0.16 * rate);
  const rng = createRng(seed);
  const snap = biquad(whiteNoise(n, rng), 'bandpass', 3100, 1.4, rate);
  const rustle = biquad(whiteNoise(n, rng), 'bandpass', 900, 1.1, rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const snapEnv = Math.min(1, t / 0.002) * Math.exp(-t / 0.028);
    const popEnv = t > 0.06 ? Math.exp(-(t - 0.06) / 0.012) * 0.7 : 0;
    const rustleEnv = Math.min(1, t / 0.02) * Math.exp(-t / 0.05);
    out[i] = (snap[i] ?? 0) * (snapEnv + popEnv) * 1.6 + (rustle[i] ?? 0) * rustleEnv * 0.6;
  }
  return out;
}

/** Short whistle blip and a card flick: a yellow. */
function renderCardYellow(): RenderedSound {
  const rate = SFX_RATE;
  const out = new Float32Array(Math.round(0.5 * rate));
  mixInto(out, whistleBlast(0.2, 3150, rate, { seed: 221 }), 0);
  mixInto(out, cardFlick(rate, 222), Math.round(0.17 * rate), 0.8);
  const wet = reverb(out, rate, { wet: 0.1, decay: 0.65 });
  applyFades(wet, 0.002, 0.03, rate);
  normalize(wet, FILE_PEAK);
  return { rate, samples: wet };
}

/** Long whistle, flick and a low thud: a red. */
function renderCardRed(): RenderedSound {
  const rate = SFX_RATE;
  const out = new Float32Array(Math.round(1.0 * rate));
  mixInto(out, whistleBlast(0.5, 2750, rate, { seed: 231, endDrop: 0.03 }), 0);
  mixInto(out, cardFlick(rate, 232), Math.round(0.45 * rate), 0.8);
  // The thud lands with the flick: a short sine that sinks from 110 to 55 Hz.
  const thudLen = Math.round(0.3 * rate);
  const thud = new Float32Array(thudLen);
  let phase = 0;
  for (let i = 0; i < thudLen; i += 1) {
    const t = i / rate;
    phase += (TAU * (55 + 55 * Math.exp(-t / 0.05))) / rate;
    thud[i] = Math.sin(phase) * Math.exp(-t / 0.09) * Math.min(1, t / 0.002);
  }
  mixInto(out, thud, Math.round(0.45 * rate), 0.9);
  const wet = reverb(out, rate, { wet: 0.12, decay: 0.7 });
  applyFades(wet, 0.002, 0.04, rate);
  normalize(wet, FILE_PEAK);
  return { rate, samples: wet };
}

// ─────────────────────────────────────────────── crowd

interface CrowdOptions {
  seconds: number;
  rate: number;
  seed: number;
  /** RMS of the noise bed (the "wash" of thousands of voices). */
  bed: number;
  /** RMS of the individual voices riding on top. */
  voiceLevel: number;
  voicesPerSec: number;
  /** 0..1 loudness contour over time (seconds). */
  swell: (t: number) => number;
  /** 0..1 brightness contour: how far the bed opens up. */
  bright: (t: number) => number;
  /** 0..1 depth of the slow wash of the bed. */
  wobble: number;
}

/**
 * A crowd made of two layers: a pink-noise bed whose low-pass opens with the
 * excitement, and many short vowel-like "voices" (a sawtooth glottis through two
 * formant filters, gliding up and down) scattered at random.
 */
function crowdTexture(o: CrowdOptions): Float32Array {
  const { rate } = o;
  const n = Math.round(o.seconds * rate);
  const rng = createRng(o.seed);

  const bed = new Float32Array(n);
  const noise = pinkNoise(n, rng);
  const hp = new Biquad('highpass', 140, 0.7, rate);
  const lpA = new Biquad('lowpass', 1500, 0.7, rate);
  const lpB = new Biquad('lowpass', 1500, 0.7, rate);
  const phaseA = rng() * TAU;
  const phaseB = rng() * TAU;
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    if (i % 64 === 0) {
      const cutoff = 1100 + 2600 * o.bright(t);
      lpA.set(cutoff, 0.7);
      lpB.set(cutoff, 0.7);
    }
    const wash = 0.5 + 0.5 * (0.6 * Math.sin(TAU * 0.23 * t + phaseA) + 0.4 * Math.sin(TAU * 0.61 * t + phaseB));
    bed[i] = lpB.process(lpA.process(hp.process(noise[i] ?? 0))) * o.swell(t) * (1 - o.wobble * wash);
  }

  const voicesLayer = new Float32Array(n);
  const count = Math.round(o.voicesPerSec * o.seconds);
  for (let v = 0; v < count; v += 1) {
    const dur = 0.14 + rng() * 0.3;
    const start = rng() * o.seconds;
    const f0 = 110 + rng() * 200;
    const formant1 = 500 + rng() * 350;
    const formant2 = 1100 + rng() * 700;
    const len = Math.round(dur * rate);
    const raw = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i += 1) {
      const f = f0 * (1 + 0.14 * Math.sin((Math.PI * i) / len));
      phase += (TAU * f) / rate;
      let s = 0;
      for (let k = 1; k <= 24 && k * f < 4200; k += 1) s += Math.sin(k * phase) / k;
      // A shout is breathy: blend aspiration noise into the voiced source.
      raw[i] = s * 0.5 + (rng() * 2 - 1);
    }
    const a = biquad(raw, 'bandpass', formant1, 5, rate);
    const b = biquad(raw, 'bandpass', formant2, 5, rate);
    for (let i = 0; i < len; i += 1) {
      const window = Math.sin((Math.PI * i) / len) ** 2;
      raw[i] = ((a[i] ?? 0) + 0.6 * (b[i] ?? 0)) * window;
    }
    const level = (0.4 + 0.6 * rng()) * o.swell(start + dur / 2);
    mixInto(voicesLayer, raw, Math.round(start * rate), level);
  }

  const out = new Float32Array(n);
  const bedK = o.bed / (rmsOf(bed) || 1);
  const voiceK = o.voiceLevel / (rmsOf(voicesLayer) || 1);
  for (let i = 0; i < n; i += 1) out[i] = (bed[i] ?? 0) * bedK + (voicesLayer[i] ?? 0) * voiceK;
  return out;
}

/** The "GOOOL": a roar that swells fast, holds, then drains, with a chiptune sting on top. */
function renderGoal(): RenderedSound {
  const rate = SFX_RATE;
  const roar = crowdTexture({
    seconds: 2.7,
    rate,
    seed: 301,
    bed: 0.22,
    voiceLevel: 0.11,
    voicesPerSec: 55,
    swell: (t) => smooth((t - 0.02) / 0.3) * (t < 1.4 ? 1 : Math.exp(-(t - 1.4) / 0.6)),
    bright: (t) => smooth(t / 0.5) * (t < 1.4 ? 1 : Math.exp(-(t - 1.4) / 0.9)),
    wobble: 0.35,
  });
  const room = reverb(roar, rate, { wet: 0.3, decay: 0.84, tailSec: 0.5 });

  // C5 – E5 – G5 – C6, a four-note arpeggio with the last note ringing out.
  const sting = new Float32Array(Math.round(0.8 * rate));
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const last = idx === notes.length - 1;
    const len = Math.round((last ? 0.45 : 0.1) * rate);
    const buf = new Float32Array(len);
    let phase = 0;
    for (let i = 0; i < len; i += 1) {
      const t = i / rate;
      phase += (TAU * freq) / rate;
      buf[i] = softSquare(phase, 7) * Math.min(1, t / 0.004) * Math.exp(-t / (last ? 0.16 : 0.07));
    }
    mixInto(sting, buf, Math.round(idx * 0.075 * rate), 1);
  });
  const stingRms = rmsOf(sting.subarray(0, Math.round(0.4 * rate)));
  const roarRms = rmsOf(room.subarray(Math.round(0.4 * rate), Math.round(1.4 * rate)));
  mixInto(room, sting, Math.round(0.03 * rate), (0.35 * roarRms) / (stingRms || 1));

  applyFades(room, 0.002, 0.25, rate);
  normalize(room, FILE_PEAK);
  return { rate, samples: room };
}

/** A shorter, gentler cheer: the final whistle went your way. */
function renderCheer(): RenderedSound {
  const rate = SFX_RATE;
  const crowd = crowdTexture({
    seconds: 1.7,
    rate,
    seed: 311,
    bed: 0.2,
    voiceLevel: 0.09,
    voicesPerSec: 40,
    swell: (t) => smooth((t - 0.02) / 0.25) * (t < 0.7 ? 1 : Math.exp(-(t - 0.7) / 0.45)),
    bright: (t) => smooth(t / 0.4) * (t < 0.7 ? 1 : Math.exp(-(t - 0.7) / 0.6)),
    wobble: 0.3,
  });
  const room = reverb(crowd, rate, { wet: 0.28, decay: 0.82, tailSec: 0.4 });
  applyFades(room, 0.002, 0.2, rate);
  normalize(room, FILE_PEAK);
  return { rate, samples: room };
}

/**
 * Stadium ambience: a restless bed with a few voices and two mild swells (a near
 * chance, a sigh). Rendered a second longer than the loop and crossfaded so the
 * end flows into the start.
 */
function renderCrowdLoop(): RenderedSound {
  const rate = AMBIENCE_RATE;
  const loopSec = 10;
  const overlapSec = 1;
  const bump = (t: number, centre: number, width: number): number =>
    Math.exp(-(((t - centre) / width) ** 2));
  const raw = crowdTexture({
    seconds: loopSec + overlapSec,
    rate,
    seed: 401,
    bed: 0.16,
    voiceLevel: 0.05,
    voicesPerSec: 7,
    swell: (t) => 1 + 0.55 * bump(t, 3.2, 0.8) + 0.35 * bump(t, 7.6, 0.9),
    bright: (t) => 0.25 + 0.3 * bump(t, 3.2, 0.8) + 0.2 * bump(t, 7.6, 0.9),
    wobble: 0.5,
  });
  const room = reverb(raw, rate, { wet: 0.35, decay: 0.85 });
  const loop = crossfadeLoop(room, Math.round(overlapSec * rate));
  normalize(loop, FILE_PEAK);
  return { rate, samples: loop };
}

/** Every recipe, keyed by the file name the catalogue expects in `public/sfx/`. */
export const RECIPES: Record<string, () => RenderedSound> = {
  'click.wav': renderClick,
  'confirm.wav': renderConfirm,
  'whistle-start.wav': renderWhistleStart,
  'whistle-end.wav': renderWhistleEnd,
  'goal.wav': renderGoal,
  'cheer.wav': renderCheer,
  'card-yellow.wav': renderCardYellow,
  'card-red.wav': renderCardRed,
  'crowd.wav': renderCrowdLoop,
};

/** Render every sound (a few seconds of CPU). */
export function renderAll(): Record<string, RenderedSound> {
  return Object.fromEntries(Object.entries(RECIPES).map(([file, render]) => [file, render()]));
}
