import { rankScorers, rankKeepers, type Pichichi, type Zamora } from '@engine';
import type { SeasonState } from './season';
import { currentStandings } from './season';
import type { SeasonSummary, PalmaresTitle } from '../career/types';

/**
 * SEASON STATISTICS & RECORDS — a purely DERIVED, deterministic read over data
 * the season already holds. Nothing here touches the game logic or the RNG: the
 * same `SeasonState` always yields the same tables (the classic PC Fútbol
 * "Estadísticas" panel). The individual leaderboards REUSE the trophy engine
 * (`rankScorers`/`rankKeepers`, whose heads are the Pichichi/Zamora), so the
 * live race and the end-of-season award can never disagree.
 */

/** How many rows the leaderboards return by default (top scorers / keepers). */
export const DEFAULT_TOP = 10;
/** How many recent matches the form streak spans by default. */
export const DEFAULT_FORM = 5;

/** One match in a team's form streak, from that team's point of view. */
export type FormOutcome = 'V' | 'E' | 'D';

/** A single played match as seen from the human's side (for the form/streak row). */
export interface FormMatch {
  opponentId: string;
  /** True when the human played at home. */
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: FormOutcome;
}

/** The human club's own season line: its table row plus its 1-indexed position. */
export interface TeamSeasonStats {
  teamId: string;
  /** 1-indexed league position from the live standings. */
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** The whole statistics panel for the season in progress. */
export interface SeasonStats {
  /** The Pichichi race, best first (already capped to the requested top N). */
  topScorers: Pichichi[];
  /** The Zamora race, least-conceded first (already capped to the requested top N). */
  topKeepers: Zamora[];
  /** The human club's own line, or null before it has a standings row. */
  team: TeamSeasonStats | null;
  /** The human's recent form, oldest→newest (already capped to the requested length). */
  form: FormMatch[];
}

/** The Pichichi race for the season so far, best first, capped to `limit`. */
export function topScorers(state: SeasonState, limit = DEFAULT_TOP): Pichichi[] {
  return rankScorers(state.results).slice(0, Math.max(0, limit));
}

/** The Zamora race for the season so far, least-conceded first, capped to `limit`. */
export function topKeepers(state: SeasonState, limit = DEFAULT_TOP): Zamora[] {
  // CompetitionTeam is structurally an AwardTeam (id + players with esPortero/media).
  return rankKeepers(state.results, state.teams).slice(0, Math.max(0, limit));
}

/**
 * The human's recent form (win/draw/loss), oldest→newest. Results are already
 * stored in matchday order, so the last `limit` involving the human club are the
 * most recent ones.
 */
export function humanForm(state: SeasonState, limit = DEFAULT_FORM): FormMatch[] {
  const me = state.humanTeamId;
  const mine: FormMatch[] = [];
  for (const r of state.results) {
    const isHome = r.homeId === me;
    const isAway = r.awayId === me;
    if (!isHome && !isAway) continue;
    const goalsFor = isHome ? r.homeGoals : r.awayGoals;
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals;
    const outcome: FormOutcome = goalsFor > goalsAgainst ? 'V' : goalsFor < goalsAgainst ? 'D' : 'E';
    mine.push({ opponentId: isHome ? r.awayId : r.homeId, home: isHome, goalsFor, goalsAgainst, outcome });
  }
  return limit >= 0 ? mine.slice(Math.max(0, mine.length - limit)) : mine;
}

/** The human club's own season line (table row + position), or null if not yet ranked. */
export function humanTeamStats(state: SeasonState): TeamSeasonStats | null {
  const table = currentStandings(state);
  const idx = table.findIndex((r) => r.teamId === state.humanTeamId);
  if (idx < 0) return null;
  const row = table[idx];
  if (!row) return null;
  return {
    teamId: row.teamId,
    position: idx + 1,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDiff,
    points: row.points,
  };
}

/** Bundle the whole statistics panel for the season in progress. */
export function seasonStats(
  state: SeasonState,
  opts: { top?: number; form?: number } = {},
): SeasonStats {
  return {
    topScorers: topScorers(state, opts.top ?? DEFAULT_TOP),
    topKeepers: topKeepers(state, opts.top ?? DEFAULT_TOP),
    team: humanTeamStats(state),
    form: humanForm(state, opts.form ?? DEFAULT_FORM),
  };
}

/** A season in which the human club's own player won the Pichichi. */
export interface OwnPichichi {
  seasonNumber: number;
  temporada: string;
  playerName: string;
  goals: number;
}

/** Career-long records DERIVED from the season history and palmarés. */
export interface CareerRecords {
  /** How many completed seasons are on record. */
  seasonsPlayed: number;
  /** The best (lowest) league position ever reached, or null with no record yet. */
  bestPosition: number | null;
  /** Total titles in the palmarés. */
  titles: number;
  /** Seasons the human club's own player finished as league top scorer, oldest first. */
  ownPichichis: OwnPichichi[];
}

/**
 * Aggregate the human's career records from the season history and palmarés — the
 * "Récords históricos" panel. Read-only and order-stable: history is already in
 * season order.
 */
export function careerRecords(
  history: readonly SeasonSummary[],
  palmares: readonly PalmaresTitle[],
  humanTeamId: string,
): CareerRecords {
  let bestPosition: number | null = null;
  const ownPichichis: OwnPichichi[] = [];
  for (const s of history) {
    if (s.humanPosition != null) {
      bestPosition = bestPosition == null ? s.humanPosition : Math.min(bestPosition, s.humanPosition);
    }
    if (s.pichichi && s.pichichi.teamId === humanTeamId) {
      ownPichichis.push({
        seasonNumber: s.seasonNumber,
        temporada: s.temporada,
        playerName: s.pichichi.playerName,
        goals: s.pichichi.goals,
      });
    }
  }
  return { seasonsPlayed: history.length, bestPosition, titles: palmares.length, ownPichichis };
}
