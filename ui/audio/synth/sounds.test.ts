import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SOUNDS } from '../catalog';
import { encodeWav, parseWavHeader, peakOf, rmsOf } from './dsp';
import { FILE_PEAK, RECIPES, renderAll, type RenderedSound } from './sounds';

// Rendering every sound is a few seconds of maths, so do it once for the file.
let rendered: Record<string, RenderedSound>;
beforeAll(() => {
  rendered = renderAll();
}, 60_000);

/** Expected duration window (seconds) per file: catches a recipe going silent or runaway. */
const DURATION: Record<string, [number, number]> = {
  'click.wav': [0.03, 0.12],
  'confirm.wav': [0.1, 0.5],
  'whistle-start.wav': [0.4, 1.5],
  'whistle-end.wav': [1.2, 3],
  'goal.wav': [2, 5],
  'cheer.wav': [1, 3],
  'card-yellow.wav': [0.3, 1],
  'card-red.wav': [0.6, 1.8],
  'crowd.wav': [6, 15],
};

/** Files the recipes are responsible for (a sound swapped for an external recording is not). */
const synthesized = Object.values(SOUNDS)
  .filter((s) => s.origin === 'synth')
  .map((s) => s.file)
  .sort();

describe('sound recipes', () => {
  it('cover exactly the synthesised files of the catalogue', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(synthesized);
    expect(Object.keys(DURATION)).toEqual(expect.arrayContaining(synthesized));
  });

  it('render finite, non-silent, normalised audio of a sensible length', () => {
    for (const [file, { samples, rate }] of Object.entries(rendered)) {
      const peak = peakOf(samples);
      expect(samples.every(Number.isFinite), `${file} has NaN/Infinity`).toBe(true);
      expect(peak, `${file} peak`).toBeCloseTo(FILE_PEAK, 2);
      expect(rmsOf(samples), `${file} is too quiet`).toBeGreaterThan(0.02);
      const [min, max] = DURATION[file]!;
      const seconds = samples.length / rate;
      expect(seconds, `${file} length`).toBeGreaterThanOrEqual(min);
      expect(seconds, `${file} length`).toBeLessThanOrEqual(max);
    }
  });

  it('carry no DC offset (a drifting centre would thump on every play)', () => {
    for (const [file, { samples }] of Object.entries(rendered)) {
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
      expect(Math.abs(mean), `${file} DC offset`).toBeLessThan(0.02);
    }
  });

  it('start and end near silence, except the loop that must wrap seamlessly', () => {
    for (const [file, { samples }] of Object.entries(rendered)) {
      if (SOUNDS[fileToId(file)].loop) continue;
      expect(Math.abs(samples[0] ?? 0), `${file} first sample`).toBeLessThan(0.05);
      expect(Math.abs(samples[samples.length - 1] ?? 0), `${file} last sample`).toBeLessThan(0.05);
    }
  });

  it('make the ambience loop flow from its last sample into its first', () => {
    const { samples } = rendered['crowd.wav']!;
    let steps = 0;
    for (let i = 1; i < samples.length; i += 1) steps += Math.abs(samples[i]! - samples[i - 1]!);
    const typical = steps / (samples.length - 1);
    const seam = Math.abs(samples[samples.length - 1]! - samples[0]!);
    expect(seam).toBeLessThan(typical * 5);
  });

  it('are deterministic: rendering twice gives identical samples', () => {
    for (const file of ['click.wav', 'confirm.wav', 'card-yellow.wav']) {
      const again = RECIPES[file]!();
      expect(Array.from(again.samples), file).toEqual(Array.from(rendered[file]!.samples));
    }
  });
});

function fileToId(file: string): keyof typeof SOUNDS {
  const id = (Object.keys(SOUNDS) as Array<keyof typeof SOUNDS>).find((k) => SOUNDS[k].file === file);
  if (!id) throw new Error(`no catalogue entry for ${file}`);
  return id;
}

describe('committed files in public/sfx', () => {
  // The WAVs are build output of these recipes. If someone edits a recipe (or a
  // WAV) without regenerating, this fails and says how to fix it. The comparison
  // is by RMS error, not byte-for-byte, so last-digit float differences between
  // Node versions or platforms cannot trip it, while any real edit to a recipe does.
  it('match what the recipes render today', () => {
    const hint = 'Regenerate with: npx tsx ui/audio/synth/generate.ts';
    for (const [file, { samples, rate }] of Object.entries(rendered)) {
      const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'public', 'sfx', file)));
      const info = parseWavHeader(bytes);
      expect(info.sampleRate, `${file}: ${hint}`).toBe(rate);
      expect(info.frames, `${file}: ${hint}`).toBe(samples.length);

      const fresh = encodeWav(samples, rate);
      const committed = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const expected = new DataView(fresh.buffer, fresh.byteOffset, fresh.byteLength);
      let sumSquares = 0;
      for (let i = 44; i < fresh.length; i += 2) {
        const diff = committed.getInt16(i, true) - expected.getInt16(i, true);
        sumSquares += diff * diff;
      }
      const rmsError = Math.sqrt(sumSquares / samples.length) / 32768;
      expect(rmsError, `${file} differs from its recipe. ${hint}`).toBeLessThan(0.002);
    }
  });
});
