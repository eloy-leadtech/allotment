import {
  buildCalendar,
  simulateFixture,
  computeStandings,
  type CompetitionTeam,
  type Fixture,
  type MatchPlayer,
  type MatchResult,
  type Scoreline,
  type StandingRow,
} from '@engine';
import type { League, Player, Team } from '@data';

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
}

function toMatchPlayer(p: Player): MatchPlayer {
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
  };
}

function toCompetitionTeam(team: Team): CompetitionTeam {
  return { id: team.id, nombre: team.nombre, players: team.jugadores.map(toMatchPlayer) };
}

/** Start a fresh season for a league, with the human managing `humanTeamId`. */
export function newSeason(league: League, humanTeamId: string, seed: number): SeasonState {
  if (league.competicion.kind !== 'league') {
    throw new Error('newSeason currently supports league competitions only');
  }
  const teams = league.equipos.map(toCompetitionTeam);
  if (!teams.some((t) => t.id === humanTeamId)) {
    throw new Error(`Human team ${humanTeamId} is not in the league`);
  }
  const fixtures = buildCalendar(teams.map((t) => t.id), seed);
  const totalMatchdays = fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  return {
    leagueId: league.id,
    temporada: league.temporada,
    seed,
    humanTeamId,
    pointsForWin: league.competicion.pointsForWin,
    relegationSpots: league.competicion.relegationSpots,
    teams,
    fixtures,
    totalMatchdays,
    currentMatchday: 1,
    results: [],
  };
}

export function isSeasonOver(state: SeasonState): boolean {
  return state.currentMatchday > state.totalMatchdays;
}

/** Fixtures scheduled for a given matchday. */
export function fixturesForMatchday(state: SeasonState, matchday: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === matchday);
}

/** Play the current matchday; returns the updated state and the results just played. */
export function advanceMatchday(state: SeasonState): { state: SeasonState; played: MatchResult[] } {
  if (isSeasonOver(state)) {
    return { state, played: [] };
  }
  const byId = new Map(state.teams.map((t) => [t.id, t]));
  const played: MatchResult[] = [];
  for (const fixture of fixturesForMatchday(state, state.currentMatchday)) {
    const home = byId.get(fixture.homeId);
    const away = byId.get(fixture.awayId);
    if (!home || !away) {
      throw new Error(`Fixture references unknown team: ${fixture.homeId} vs ${fixture.awayId}`);
    }
    played.push(simulateFixture(home, away, state.seed, fixture));
  }
  return {
    state: { ...state, results: [...state.results, ...played], currentMatchday: state.currentMatchday + 1 },
    played,
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
