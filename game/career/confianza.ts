/**
 * Confianza de la DIRECTIVA y ánimo de la AFICIÓN — the two 0-100 meters the
 * classic PC Fútbol showed on the "JUNTA DIRECTIVA" screen (`CONFIANZA DE LOS
 * DIRECTIVOS`, `CONFIANZA DEL PÚBLICO`). They are the club's institutional morale:
 * they rise when the season beats the board's objective and fall when it misses,
 * and a directiva meter in free-fall is what ends the manager's tenure.
 *
 * Pure and deterministic. Unlike the board OBJECTIVE (which is re-derivable from
 * the squads), confianza is an EVOLVING value that ACCUMULATES across seasons, so
 * it is carried on the career and persisted in save v2 — it is NOT re-derived
 * inside `seasonFromCareer`. Each season transition folds that season's verdict
 * into the running meters via `applyConfianza`; the same career always yields the
 * same confianza because the inputs (satisfaction, shortfall, outcome, título)
 * are themselves deterministic.
 */
import type { Satisfaction } from './board';
import type { PromotionOutcome } from './promotion';

/** The two institutional confidence meters, each an integer 0-100. */
export interface ConfianzaState {
  /** Confianza de la directiva (the board's faith in the manager). */
  directiva: number;
  /** Ánimo de la afición (the public's mood). */
  aficion: number;
}

/** A fresh career (and every pre-confianza save) starts at a neutral 50/50. */
export const DEFAULT_CONFIANZA: ConfianzaState = { directiva: 50, aficion: 50 };

/**
 * Directiva at or below this level triggers a PREVIOUS WARNING: the board studies
 * the manager's continuity. Above the sack line, so it is a shot across the bows.
 */
export const CONFIANZA_WARNING = 30;
/** Directiva at or below this level means the board loses its faith and sacks the manager. */
export const CONFIANZA_SACK = 15;

/** The just-finished season's verdict, as fed into the confianza update. */
export interface ConfianzaInput {
  /** How the board rated the objective (from `evaluateObjective`). */
  satisfaction: Satisfaction;
  /** Final position minus target: <=0 met/beaten, >0 fell short by that many places. */
  shortfall: number;
  /** Promotion/relegation outcome of the season. */
  outcome: PromotionOutcome;
  /** True when the human won their league this season (a big morale lift). */
  championLeague: boolean;
}

/** Clamp a raw meter value into the 0-100 range. */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Fold one finished season's verdict into the running confianza meters.
 *
 * The directiva reacts to the OBJECTIVE: beating it lifts them, missing it (the
 * bigger the shortfall, the worse) drags them down, promotion cheers and
 * relegation hammers them. The afición reacts to the same events but harder and
 * more emotionally — a título or an ascenso sends them into raptures, a descenso
 * turns them against the manager. Both are clamped to 0-100.
 *
 * The directiva deltas are CALIBRATED for board patience (a faithful nod to the
 * classic game): the worst single NON-relegation season from a neutral 50 lands
 * at ~20 — inside the WARNING band but clear of the SACK line — so ONE missed
 * objective is an aviso, never a cese. It takes a SECOND straight bad season to
 * collapse the meter to the sack line. Relegation is handled as a hard verdict
 * elsewhere (see board.ts), so it need not (and does not) sack via this meter.
 *
 * Pure: integer arithmetic on deterministic inputs, no RNG, locale or Date.
 */
export function applyConfianza(current: ConfianzaState, input: ConfianzaInput): ConfianzaState {
  const { satisfaction, shortfall, outcome, championLeague } = input;

  const dirBase = satisfaction === 'contento' ? 14 : satisfaction === 'normal' ? 3 : -14;
  const afiBase = satisfaction === 'contento' ? 16 : satisfaction === 'normal' ? 0 : -14;

  // Proportional to how far the target was missed (penalty) or beaten (bonus).
  // The directiva penalty is capped at 8 places so the worst single season stays
  // survivable (a warning, not a cese) — sustained misses are what sink the meter.
  const dirShort = shortfall > 0 ? -Math.min(shortfall, 8) * 2 : Math.min(-shortfall, 6) * 2;
  const afiShort = shortfall > 0 ? -Math.min(shortfall, 10) * 2 : Math.min(-shortfall, 6) * 3;

  const dirOutcome = outcome === 'promoted' ? 8 : outcome === 'relegated' ? -20 : 0;
  const afiOutcome = outcome === 'promoted' ? 14 : outcome === 'relegated' ? -18 : 0;

  const dirTitle = championLeague ? 8 : 0;
  const afiTitle = championLeague ? 14 : 0;

  return {
    directiva: clamp(current.directiva + dirBase + dirShort + dirOutcome + dirTitle),
    aficion: clamp(current.aficion + afiBase + afiShort + afiOutcome + afiTitle),
  };
}

/**
 * True when the directiva meter is in the WARNING band (at or below the warning
 * line but still above the sack line): the board is worried but has not acted.
 */
export function directivaEnAviso(confianza: ConfianzaState): boolean {
  return confianza.directiva <= CONFIANZA_WARNING && confianza.directiva > CONFIANZA_SACK;
}

/** True when the directiva meter has collapsed to the sack line: the board dismisses the manager. */
export function confianzaProvocaCese(confianza: ConfianzaState): boolean {
  return confianza.directiva <= CONFIANZA_SACK;
}
