/**
 * Cuerpo técnico: the club's technical STAFF beyond the manager. A faithful nod to
 * the classic PC Fútbol, where you hired a segundo entrenador, a preparador físico,
 * a médico and an ojeador, each with a NIVEL and a COSTE, and each quietly making a
 * real system of the game work a little better.
 *
 * Pure and deterministic. Each role is either VACANT or filled by one member on the
 * classic 1-5 level scale. The state is a plain DECISION (persisted in save v2): the
 * levels and salaries are all derived, no RNG, the clock or the locale, so the same
 * career always books the same wages and the same bonuses on every machine.
 *
 * Each role hooks an EXISTING system (this module owns only the numbers; the wiring
 * lives where the system does):
 *  - preparador físico → better TRAINING gains (development.ts / training.ts).
 *  - médico            → faster INJURY recovery (availability.ts / season.ts).
 *  - ojeador           → more precise SCOUTING reports (scouting.ts / ojeo.ts).
 *  - segundo entrenador→ a small match PERFORMANCE bonus (career.ts seasonFromCareer).
 * The salaries feed the season liquidation like any other wage (finances/credit).
 */
import type { CareerState } from './types';

/** The four technical-staff roles the manager can hire. */
export type StaffRole = 'segundo' | 'preparador' | 'medico' | 'ojeador';

/** A hired staff member: just the level; salary and effects are derived from it. */
export interface StaffMember {
  /** Hired level on the classic 1-5 scale. */
  level: number;
}

/**
 * The club's technical staff: a hired member per role, or the role ABSENT (vacant).
 * A plain decision carried on the career and persisted in save v2; an empty object
 * (the default) means the manager works alone, with no bonuses and no staff wages.
 */
export type StaffState = Partial<Record<StaffRole, StaffMember>>;

/** A fresh career (and every pre-staff save) starts with no staff hired. */
export const DEFAULT_STAFF: StaffState = {};

/** The level scale: 1 (junior) to 5 (elite). Hiring outside this range is rejected. */
export const STAFF_MIN_LEVEL = 1;
export const STAFF_MAX_LEVEL = 5;

/** Static per-role metadata: label, one-line pitch, and the salary slope. */
interface StaffRoleMeta {
  role: StaffRole;
  label: string;
  hint: string;
  /** Annual salary PER LEVEL (euros): salary = salaryPerLevel * level. */
  salaryPerLevel: number;
}

/**
 * The role ladder, ordered for the UI. Salaries are sized to MATTER against the
 * squad's masa salarial without dwarfing it: a top (level 5) professional runs a
 * bit over a million a year, a junior a few hundred thousand.
 */
export const STAFF_ROLES: readonly StaffRoleMeta[] = [
  {
    role: 'segundo',
    label: 'Segundo entrenador',
    hint: 'Un pequeño plus de rendimiento al equipo en el terreno de juego.',
    salaryPerLevel: 250_000,
  },
  {
    role: 'preparador',
    label: 'Preparador físico',
    hint: 'Tu plantilla progresa más en los entrenamientos.',
    salaryPerLevel: 220_000,
  },
  {
    role: 'medico',
    label: 'Médico',
    hint: 'Tus jugadores se recuperan antes de las lesiones.',
    salaryPerLevel: 220_000,
  },
  {
    role: 'ojeador',
    label: 'Ojeador',
    hint: 'Informes de ojeo más precisos: menos error al estimar el nivel.',
    salaryPerLevel: 200_000,
  },
] as const;

/** Up-front hiring fee as a fraction of the first year's salary (la prima). */
export const STAFF_HIRE_FEE_FRACTION = 0.5;

/** Look up a role's static metadata (throws on an unknown role — programmer error). */
function roleMeta(role: StaffRole): StaffRoleMeta {
  const meta = STAFF_ROLES.find((r) => r.role === role);
  if (!meta) throw new Error(`Unknown staff role: ${role}`);
  return meta;
}

/** True if `level` is a valid hire level (integer within 1-5). */
export function isStaffLevel(level: number): boolean {
  return Number.isInteger(level) && level >= STAFF_MIN_LEVEL && level <= STAFF_MAX_LEVEL;
}

/** The annual salary a role commands at a given level (whole euros). */
export function staffSalary(role: StaffRole, level: number): number {
  return roleMeta(role).salaryPerLevel * level;
}

/** The up-front signing fee (prima) to hire a role at a given level (whole euros). */
export function staffHireCost(role: StaffRole, level: number): number {
  return Math.round(staffSalary(role, level) * STAFF_HIRE_FEE_FRACTION);
}

/** The hired level for a role (0 when the role is vacant / staff absent). */
export function staffLevel(staff: StaffState | undefined, role: StaffRole): number {
  return staff?.[role]?.level ?? 0;
}

/** The club's total annual STAFF wage bill: the sum of every hired member's salary. */
export function staffWageBill(staff: StaffState | undefined): number {
  if (!staff) return 0;
  let total = 0;
  for (const meta of STAFF_ROLES) {
    const member = staff[meta.role];
    if (member) total += staffSalary(meta.role, member.level);
  }
  return total;
}

/** One hireable option in the staff market: a role at a level, with its costs. */
export interface StaffOption {
  role: StaffRole;
  level: number;
  /** Annual salary charged against the budget each season (see finances). */
  salary: number;
  /** Up-front fee paid now to sign this option. */
  hireCost: number;
}

/**
 * The full ladder of hire options for a role (levels 1-5, cheapest first). A pure,
 * deterministic "market": you pick the calibre of professional you can afford, and
 * pay the matching salary and signing fee.
 */
export function staffOptions(role: StaffRole): StaffOption[] {
  const options: StaffOption[] = [];
  for (let level = STAFF_MIN_LEVEL; level <= STAFF_MAX_LEVEL; level += 1) {
    options.push({ role, level, salary: staffSalary(role, level), hireCost: staffHireCost(role, level) });
  }
  return options;
}

/** The outcome of hiring a staff member. */
export interface HireStaffResult {
  career: CareerState;
  ok: boolean;
  /**
   * - `nivel`: the requested level is outside the 1-5 scale.
   * - `presupuesto`: you can't afford the up-front signing fee.
   */
  reason?: 'nivel' | 'presupuesto';
}

/**
 * HIRE (or upgrade) a role at `level`, paying the signing fee out of the budget. A
 * pure DECISION: it moves only the budget and the staff slot, so the in-progress
 * season and every roster stay put — the recurring salary lands at the season
 * liquidation like any other wage. Soft-fails on a bad level or too little budget.
 *
 * Note: the staff EFFECTS on the current season (medical recovery, the segundo's
 * performance bonus) are baked in when the season is derived (see seasonFromCareer),
 * so the caller re-derives the not-yet-started season after hiring. Restricting
 * hiring to the pretemporada keeps that re-derivation from rewriting played results.
 */
export function hireStaff(career: CareerState, role: StaffRole, level: number): HireStaffResult {
  if (!isStaffLevel(level)) return { career, ok: false, reason: 'nivel' };
  const cost = staffHireCost(role, level);
  if (career.budget < cost) return { career, ok: false, reason: 'presupuesto' };
  const staff: StaffState = { ...(career.staff ?? DEFAULT_STAFF), [role]: { level } };
  return { career: { ...career, budget: career.budget - cost, staff }, ok: true };
}

/**
 * FIRE the member in a role, leaving it vacant. Pure: it drops the recurring salary
 * from next season's wage bill and removes the role's bonus. Free of charge (no
 * finiquito), so the only budget effect is the wages you stop paying. A no-op if the
 * role was already vacant.
 */
export function fireStaff(career: CareerState, role: StaffRole): CareerState {
  const current = career.staff;
  if (!current?.[role]) return career;
  const staff: StaffState = { ...current };
  delete staff[role];
  return { ...career, staff };
}

// --- Effect numbers, consumed by the systems each role hooks --------------------

/** How much a preparador físico of `level` amplifies each POSITIVE training gain. */
const PHYSIO_GAIN_PER_LEVEL = 0.06;
/** How much a médico of `level` shortens injury recovery (per level). */
const MEDICO_RECOVERY_PER_LEVEL = 0.1;
/** Media (rating) points the segundo entrenador adds per level in matches. */
const ASSISTANT_MEDIA_PER_LEVEL = 0.6;

/**
 * The training multiplier the preparador físico applies to a squad's POSITIVE
 * per-attribute training gains (>= 1; exactly 1 with no preparador). Wired into the
 * aging/training curve at the season transition (see development.ts / training.ts).
 */
export function physioTrainingFactor(staff: StaffState | undefined): number {
  return 1 + staffLevel(staff, 'preparador') * PHYSIO_GAIN_PER_LEVEL;
}

/**
 * The multiplier applied to a HUMAN player's injury length (in (0,1]; exactly 1
 * with no médico). A better médico gets your players back sooner. Wired into the
 * availability engine for the human squad only (see availability.ts / season.ts).
 */
export function medicalRecoveryFactor(staff: StaffState | undefined): number {
  return 1 - staffLevel(staff, 'medico') * MEDICO_RECOVERY_PER_LEVEL;
}

/**
 * The scouting precision LEVEL of the ojeador (0-5; 0 with no ojeador). A higher
 * level tightens the report band AND pulls its centre towards the truth, so the
 * estimate carries less error (see scouting.ts scoutEstimate / abilityEstimate).
 */
export function scoutPrecisionLevel(staff: StaffState | undefined): number {
  return staffLevel(staff, 'ojeador');
}

/**
 * The flat media (rating) bonus the segundo entrenador grants the human squad in
 * matches (0 with no segundo). Applied when the season's competition teams are
 * derived (see career.ts seasonFromCareer); it never touches the stored squad data.
 */
export function assistantPerformanceBonus(staff: StaffState | undefined): number {
  return staffLevel(staff, 'segundo') * ASSISTANT_MEDIA_PER_LEVEL;
}
