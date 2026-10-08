/**
 * Catalogue of the game's sound effects. Every file lives in `public/sfx/` and
 * is an ORIGINAL work: synthesised offline by `synth/generate.ts` (see
 * `public/sfx/README.md`), never sampled from Dinamic or anyone else.
 */
export type SoundId =
  | 'click'
  | 'confirm'
  | 'whistle-start'
  | 'whistle-end'
  | 'goal'
  | 'cheer'
  | 'card-yellow'
  | 'card-red'
  | 'crowd';

/** Groups sounds for future per-category volume controls. */
export type SoundCategory = 'ui' | 'match' | 'ambience';

export interface SoundDef {
  /** File name inside `public/sfx/`. */
  file: string;
  /**
   * Mix level 0..1 relative to the other sounds. The files are all normalised to
   * the same peak, so this is where their balance lives; the master volume is
   * applied on top.
   */
  gain: number;
  category: SoundCategory;
  /** Loops until stopped (stadium ambience). */
  loop: boolean;
  /**
   * Minimum ms between two plays of this sound: a retrigger inside the window is
   * dropped, so a long whistle never stacks on itself when the player mashes a button.
   */
  minGapMs: number;
  /**
   * Where the file comes from: `synth` = rendered by `synth/sounds.ts` (the default;
   * tests keep file and recipe in step), `external` = a recording someone supplied.
   */
  origin: 'synth' | 'external';
  /** For `external` sounds: author, source and licence (mirror it in ASSETS.md). */
  credit?: string;
  /** What it is, for humans reading the catalogue. */
  description: string;
}

export const SOUNDS: Record<SoundId, SoundDef> = {
  click: {
    file: 'click.wav',
    gain: 0.45,
    category: 'ui',
    loop: false,
    minGapMs: 30,
    origin: 'synth',
    description: 'Soft UI tick on any button.',
  },
  confirm: {
    file: 'confirm.wav',
    gain: 0.4,
    category: 'ui',
    loop: false,
    minGapMs: 30,
    origin: 'synth',
    description: 'Two-note blip for primary actions (play matchday, sign, confirm).',
  },
  'whistle-start': {
    file: 'whistle-start.wav',
    gain: 0.45,
    category: 'match',
    loop: false,
    minGapMs: 800,
    origin: 'synth',
    description: 'Referee: one blast, kick-off.',
  },
  'whistle-end': {
    file: 'whistle-end.wav',
    gain: 0.45,
    category: 'match',
    loop: false,
    minGapMs: 1500,
    origin: 'synth',
    description: 'Referee: short-short-long, full time.',
  },
  goal: {
    file: 'goal.wav',
    gain: 1,
    category: 'match',
    loop: false,
    minGapMs: 1200,
    origin: 'synth',
    description: 'Crowd roar over a short chiptune sting.',
  },
  cheer: {
    file: 'cheer.wav',
    gain: 0.7,
    category: 'match',
    loop: false,
    minGapMs: 1500,
    origin: 'synth',
    description: 'Shorter crowd cheer: you won.',
  },
  'card-yellow': {
    file: 'card-yellow.wav',
    gain: 0.45,
    category: 'match',
    loop: false,
    minGapMs: 500,
    origin: 'synth',
    description: 'Short whistle and card flick.',
  },
  'card-red': {
    file: 'card-red.wav',
    gain: 0.5,
    category: 'match',
    loop: false,
    minGapMs: 500,
    origin: 'synth',
    description: 'Long whistle, flick and a low thud: sent off.',
  },
  crowd: {
    file: 'crowd.wav',
    gain: 0.4,
    category: 'ambience',
    loop: true,
    minGapMs: 0,
    origin: 'synth',
    description: 'Stadium crowd ambience, seamless loop.',
  },
};

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

export function isSoundId(value: unknown): value is SoundId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SOUNDS, value);
}

/** Public URL of a sound, honouring Vite's `base` (GitHub Pages subpath, Capacitor). */
export function soundUrl(id: SoundId, base: string = import.meta.env.BASE_URL): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}sfx/${SOUNDS[id].file}`;
}
