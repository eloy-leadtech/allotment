/**
 * Renders every sound effect to `public/sfx/*.wav` (16-bit mono PCM).
 *
 *   npx tsx ui/audio/synth/generate.ts            # writes into public/sfx
 *   npx tsx ui/audio/synth/generate.ts <outDir>   # or anywhere else
 *
 * Deterministic: running it twice yields identical files, so the committed WAVs
 * are auditable against this source. Node-only script, never bundled in the app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav, peakOf, rmsOf } from './dsp';
import { renderAll } from './sounds';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, '..', '..', '..', 'public', 'sfx'));
mkdirSync(outDir, { recursive: true });

const db = (x: number): string => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');

console.log(`Writing sound effects to ${outDir}`);
console.log('file                 rate   secs   bytes    peak dBFS  rms dBFS');
let total = 0;
for (const [file, { rate, samples }] of Object.entries(renderAll())) {
  const wav = encodeWav(samples, rate);
  writeFileSync(join(outDir, file), wav);
  total += wav.length;
  console.log(
    `${file.padEnd(20)} ${String(rate).padStart(5)} ${(samples.length / rate).toFixed(2).padStart(6)} ` +
      `${String(wav.length).padStart(7)}   ${db(peakOf(samples)).padStart(8)}  ${db(rmsOf(samples)).padStart(8)}`,
  );
}
console.log(`Total: ${(total / 1024).toFixed(0)} KiB`);
