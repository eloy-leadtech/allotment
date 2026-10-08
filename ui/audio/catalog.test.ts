import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUNDS, SOUND_IDS, isSoundId, soundUrl, type SoundId } from './catalog';
import { parseWavHeader } from './synth/dsp';

describe('sound catalogue', () => {
  it('lists every sound once, each with its own file', () => {
    const files = SOUND_IDS.map((id) => SOUNDS[id].file);
    expect(new Set(files).size).toBe(files.length);
    expect(SOUND_IDS.length).toBeGreaterThanOrEqual(9);
  });

  it('keeps gains inside 0..1', () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].gain, id).toBeGreaterThan(0);
      expect(SOUNDS[id].gain, id).toBeLessThanOrEqual(1);
    }
  });

  it('gives every sound a sane retrigger gap, longest for the referee', () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].minGapMs, id).toBeGreaterThanOrEqual(0);
      expect(SOUNDS[id].minGapMs, id).toBeLessThan(3000);
    }
    expect(SOUNDS['whistle-end'].minGapMs).toBeGreaterThan(SOUNDS.click.minGapMs);
  });

  it('credits every recording that is not synthesised by this repo', () => {
    for (const id of SOUND_IDS) {
      if (SOUNDS[id].origin === 'external') {
        expect(SOUNDS[id].credit?.trim(), `${id} needs author, source and licence`).toBeTruthy();
      }
    }
  });

  it('only loops the ambience', () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].loop, id).toBe(SOUNDS[id].category === 'ambience');
    }
  });

  it('ships a valid mono 16-bit WAV in public/sfx for every entry', () => {
    for (const id of SOUND_IDS) {
      const path = join(process.cwd(), 'public', 'sfx', SOUNDS[id].file);
      expect(existsSync(path), `${path} is missing`).toBe(true);
      const info = parseWavHeader(new Uint8Array(readFileSync(path)));
      expect(info.channels, id).toBe(1);
      expect(info.bitsPerSample, id).toBe(16);
      expect(info.sampleRate, id).toBeGreaterThanOrEqual(8000);
      expect(info.durationSec, id).toBeGreaterThan(0.02);
      expect(info.durationSec, id).toBeLessThan(20);
    }
  });

  it('keeps the whole pack light (it ships in the APK and the web build)', () => {
    let total = 0;
    for (const id of SOUND_IDS) {
      total += readFileSync(join(process.cwd(), 'public', 'sfx', SOUNDS[id].file)).length;
    }
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });
});

describe('isSoundId', () => {
  it('accepts catalogue ids and nothing else', () => {
    expect(isSoundId('goal')).toBe(true);
    expect(isSoundId('whistle-end')).toBe(true);
    expect(isSoundId('nope')).toBe(false);
    expect(isSoundId('toString')).toBe(false);
    expect(isSoundId(undefined)).toBe(false);
  });
});

describe('soundUrl', () => {
  const id: SoundId = 'click';

  it('prefixes the Vite base', () => {
    expect(soundUrl(id, '/')).toBe('/sfx/click.wav');
    expect(soundUrl(id, '/allotment/')).toBe('/allotment/sfx/click.wav');
  });

  it('tolerates a base without a trailing slash', () => {
    expect(soundUrl(id, '/allotment')).toBe('/allotment/sfx/click.wav');
  });
});
