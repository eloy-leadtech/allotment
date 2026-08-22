/**
 * Entrenamiento: the manager's TRAINING FOCUS for the season. A faithful nod to
 * the classic PC Fútbol, where how you drilled the squad tilted which attributes
 * grew. It is a deterministic LAYER on top of the aging curve in development.ts:
 * it nudges each attribute's per-season trend BEFORE the seeded jitter, so it
 * introduces no new randomness and stays reproducible across save/load.
 *
 * The effect is MODERATE and roughly zero-sum for the specialised foci — you
 * accelerate the attributes you drill at the cost of the ones you neglect — so
 * training sharpens a squad's identity without turning everyone into cracks.
 * `equilibrado` is a gentle all-round boost (a well-run, balanced pretemporada),
 * and young players (<=21) are a touch more trainable on the attributes gained.
 */
import type { Attributes } from '@data';

/** The four training foci the manager can pick each season. */
export type TrainingFocus = 'ataque' | 'defensa' | 'fisico' | 'equilibrado';

/** The human club's training choice, stored on the career and persisted. */
export interface TrainingState {
  focus: TrainingFocus;
}

/** Ordered list of foci for the UI (with Spanish labels). */
export const TRAINING_FOCI: readonly { focus: TrainingFocus; label: string; hint: string }[] = [
  { focus: 'ataque', label: 'Ataque', hint: 'Mejora remate, juego ofensivo y pase; descuida la defensa.' },
  { focus: 'defensa', label: 'Defensa', hint: 'Mejora entrada y físico defensivo; descuida la pegada.' },
  { focus: 'fisico', label: 'Físico', hint: 'Mejora resistencia, velocidad y físico; descuida la técnica.' },
  { focus: 'equilibrado', label: 'Equilibrado', hint: 'Progreso suave y repartido en todas las facetas.' },
];

/** Default focus for a fresh career and for pre-training saves. */
export const DEFAULT_TRAINING_FOCUS: TrainingFocus = 'equilibrado';

/**
 * Per-attribute trend adjustment for each focus, added to the age trend before
 * jitter. Positive = accelerate, negative = neglect. The specialised foci roughly
 * cancel out (net near zero) so the squad's OVERALL level is preserved while its
 * shape shifts; `equilibrado` is uniformly, mildly positive.
 */
const FOCUS_DELTAS: Record<TrainingFocus, Partial<Record<keyof Attributes, number>>> = {
  ataque: { remate: 0.9, ofensivo: 0.9, pase: 0.4, velocidad: 0.2, entrada: -0.7, fisico: -0.4 },
  defensa: { entrada: 1.0, fisico: 0.6, agresividad: 0.4, resistencia: 0.2, remate: -0.7, ofensivo: -0.5 },
  fisico: { fisico: 0.8, resistencia: 0.8, velocidad: 0.6, pase: -0.4, remate: -0.4, ofensivo: -0.3 },
  equilibrado: {
    calidad: 0.3,
    remate: 0.25,
    ofensivo: 0.25,
    pase: 0.25,
    entrada: 0.25,
    fisico: 0.25,
    velocidad: 0.25,
    resistencia: 0.2,
    agresividad: 0.2,
    porteria: 0.2,
  },
};

/** Age at/below which a player gains a little extra from the focused drills. */
const YOUTH_TRAINABLE_AGE = 21;
/** How much a young player's POSITIVE training gains are amplified. */
const YOUTH_TRAIN_FACTOR = 1.5;

/**
 * The trend delta training applies to one attribute this season. Deterministic
 * (no RNG): a pure function of focus, attribute, age and the preparador físico's
 * multiplier. Neglect (negative) is never amplified — only the attributes being
 * trained up get the youth boost and the physio boost.
 *
 * `physioFactor` (>= 1, default 1) is the preparador físico's amplifier on positive
 * gains: a better preparador makes your squad progress more in training (see
 * staff.ts `physioTrainingFactor`). It never worsens neglect.
 */
export function trainingAttributeDelta(
  focus: TrainingFocus,
  key: keyof Attributes,
  age: number | null,
  physioFactor = 1,
): number {
  const base = FOCUS_DELTAS[focus][key] ?? 0;
  if (base <= 0) return base;
  const youthFactor = age !== null && age <= YOUTH_TRAINABLE_AGE ? YOUTH_TRAIN_FACTOR : 1;
  return base * youthFactor * physioFactor;
}
