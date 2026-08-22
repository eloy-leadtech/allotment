import {
  buildCalendar,
  simulateFixture,
  computeStandings,
  NEUTRAL_FORM,
  NEUTRAL_MORALE,
  FRESH_FATIGUE,
  type CompetitionTeam,
  type Fixture,
  type MatchPlayer,
  type MatchResult,
  type Scoreline,
  type StandingRow,
} from '@engine';
import type { League, Player, Team } from '@data';
import {
  applyMatchdayAvailability,
  isAvailable,
  type AvailabilityMap,
  type MedicalStaff,
} from '../career/availability';
import { applyFormMorale } from './formMorale';
import { applyFatigue } from './fatigue';
import { applyInternationalBreak, type CallUpNotice } from './convocatorias';

export interface SeasonState {
  leagueId: string;
  temporada: string;
  seed: number;
  humanTeamId: string;
  pointsForWin: 2 | 3;
  relegationSpots: number;
  teams: CompetitionTeam[];
  fixtures: Fixture[];
  totalMatchdays: number;
  /** Next matchday to play (1-indexed). currentMatchday > totalMatchdays => finished. */
  currentMatchday: number;
  results: MatchResult[];
  /**
   * Injuries/suspensions by player id. DERIVED (rebuilt by the save/load replay),
   * never persisted directly; empty at kick-off.
   */
  availability: AvailabilityMap;
  /**
   * The human club's MÉDICO effect on injuries, if any: it shortens the layoff for
   * the human squad. DERIVED from the career's staff when the season is built (see
   * career.ts seasonFromCareer), so it is reconstructed by the save/load replay and
   * never persisted. Absent = no médico (normal recovery for everyone).
   */
  medical?: MedicalStaff;
}

export function toMatchPlayer(p: Player): MatchPlayer {
  return {
    id: p.id,
    nombre: p.nombre,
    posicion: p.posicion,
    esPortero: p.esPortero,
    media: p.media,
    remate: p.atributos.remate,
    ofensivo: p.atributos.ofensivo,
    pase: p.atributos.pase,
    entrada: p.atributos.entrada,
    porteria: p.atributos.porteria,
    // Every season starts neutral/fresh; form/morale/fatigue evolve as matchdays
    // are played (all re-derived by the save/load replay — never persisted).
    form: NEUTRAL_FORM,
    morale: NEUTRAL_MORALE,
    fatigue: FRESH_FATIGUE,
    // Carried through purely as a call-up signal (see convocatorias); null becomes
    // absent so a player with unknown nationality behaves as "no signal".
    nacionalidad: p.nacionalidad ?? undefined,
  };
}

export function toCompetitionTeam(team: Team): CompetitionTeam {
  return { id: team.id, nombre: team.nombre, players: team.jugadores.map(toMatchPlayer) };
}

/** Metadata a season needs beyond its teams and seed. */
export interface SeasonMeta {
  leagueId: string;
  temporada: string;
  humanTeamId: string;
  pointsForWin: 2 | 3;
  relegationSpots: number;
}

/**
 * Build a fresh season from already-mapped competition teams. Shared by the
 * single-season entry point (`newSeason`) and the career layer (which owns full
 * player data and derives its competition teams itself).
 */
export function newSeasonFromTeams(
  teams: CompetitionTeam[],
  meta: SeasonMeta,
  seed: number,
): SeasonState {
  if (!teams.some((t) => t.id === meta.humanTeamId)) {
    throw new Error(`Human team ${meta.humanTeamId} is not in the league`);
  }
  const fixtures = buildCalendar(teams.map((t) => t.id), seed);
  const totalMatchdays = fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  return {
    leagueId: meta.leagueId,
    temporada: meta.temporada,
    seed,
    humanTeamId: meta.humanTeamId,
    pointsForWin: meta.pointsForWin,
    relegationSpots: meta.relegationSpots,
    teams,
    fixtures,
    totalMatchdays,
    currentMatchday: 1,
    results: [],
    availability: {},
  };
}

/** Start a fresh season for a league, with the human managing `humanTeamId`. */
export function newSeason(league: League, humanTeamId: string, seed: number): SeasonState {
  if (league.competicion.kind !== 'league') {
    throw new Error('newSeason currently supports league competitions only');
  }
  return newSeasonFromTeams(
    league.equipos.map(toCompetitionTeam),
    {
      leagueId: league.id,
      temporada: league.temporada,
      humanTeamId,
      pointsForWin: league.competicion.pointsForWin,
      relegationSpots: league.competicion.relegationSpots,
    },
    seed,
  );
}

export function isSeasonOver(state: SeasonState): boolean {
  return state.currentMatchday > state.totalMatchdays;
}

/** Fixtures scheduled for a given matchday. */
export function fixturesForMatchday(state: SeasonState, matchday: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === matchday);
}

/** The human's fixture for the upcoming matchday, or null if the season is over. */
export function nextHumanFixture(state: SeasonState): Fixture | null {
  if (isSeasonOver(state)) return null;
  const fixtures = fixturesForMatchday(state, state.currentMatchday);
  return fixtures.find((f) => f.homeId === state.humanTeamId || f.awayId === state.humanTeamId) ?? null;
}

/**
 * The team as it lines up on `matchday`: injured/suspended players are dropped so
 * the auto-XI (and the chosen XI) skip them. If fewer than 11 remain fit, the
 * full squad is kept — the engine still needs eleven bodies on the pitch.
 */
function fieldableTeam(
  team: CompetitionTeam,
  availability: AvailabilityMap,
  matchday: number,
): CompetitionTeam {
  const fit = team.players.filter((p) => isAvailable(availability[p.id], matchday));
  const players = fit.length >= 11 ? fit : team.players;
  if (players.length === team.players.length) return team;
  // Drop any explicitly-chosen starters that are now unavailable; if the XI can
  // no longer be honoured (fewer than 11 fit picks) fall back to the auto-XI.
  let tactics = team.tactics;
  if (tactics?.xi) {
    const fitIds = new Set(players.map((p) => p.id));
    const xi = tactics.xi.filter((p) => fitIds.has(p.id));
    tactics = xi.length === 11 ? { ...tactics, xi } : { formation: tactics.formation };
  }
  return { ...team, players, tactics };
}

/** Play the current matchday; returns the updated state and the results just played. */
export function advanceMatchday(state: SeasonState): {
  state: SeasonState;
  played: MatchResult[];
  /** Set only when the matchday just played coincided with a national-team parón
   * and the human club had at least one player called up (see convocatorias). */
  callUp?: CallUpNotice;
} {
  if (isSeasonOver(state)) {
    return { state, played: [] };
  }
  const matchday = state.currentMatchday;
  const byId = new Map(state.teams.map((t) => [t.id, t]));
  const played: MatchResult[] = [];
  for (const fixture of fixturesForMatchday(state, matchday)) {
    const home = byId.get(fixture.homeId);
    const away = byId.get(fixture.awayId);
    if (!home || !away) {
      throw new Error(`Fixture references unknown team: ${fixture.homeId} vs ${fixture.awayId}`);
    }
    const homeXI = fieldableTeam(home, state.availability, matchday);
    const awayXI = fieldableTeam(away, state.availability, matchday);
    played.push(simulateFixture(homeXI, awayXI, state.seed, fixture));
  }
  const availability = applyMatchdayAvailability(state.availability, played, matchday, state.medical);
  // Evolve form/morale and fatigue from the matchday just played (deterministic:
  // replaying the season from its neutral/fresh start always rebuilds the same
  // values, so neither has to be persisted). Fatigue after so it reads the same
  // fielded XI; the two updates touch independent player fields.
  const fatigued = applyFatigue(applyFormMorale(state.teams, played), played);
  // On a national-team parón matchday the internationals return with extra fatigue
  // stacked on top; a no-op on every other matchday. Deterministic and unpersisted
  // just like fatigue, so the replay reconstructs it identically.
  const { teams, notice } = applyInternationalBreak(fatigued, {
    matchday,
    seed: state.seed,
    totalMatchdays: state.totalMatchdays,
    humanTeamId: state.humanTeamId,
  });
  return {
    state: {
      ...state,
      teams,
      results: [...state.results, ...played],
      currentMatchday: matchday + 1,
      availability,
    },
    played,
    ...(notice ? { callUp: notice } : {}),
  };
}

const toScoreline = (r: MatchResult): Scoreline => ({
  homeId: r.homeId,
  awayId: r.awayId,
  homeGoals: r.homeGoals,
  awayGoals: r.awayGoals,
});

/** Current league table from the results played so far. */
export function currentStandings(state: SeasonState): StandingRow[] {
  return computeStandings(
    state.teams.map((t) => t.id),
    state.results.map(toScoreline),
    state.pointsForWin,
  );
}

/** Resolve a team id to its display name. */
export function teamName(state: SeasonState, teamId: string): string {
  return state.teams.find((t) => t.id === teamId)?.nombre ?? teamId;
}
