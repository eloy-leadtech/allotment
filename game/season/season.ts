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
import {
  applyMatchdayAvailability,
  isAvailable,
  type AvailabilityMap,
} from '../career/availability';

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
export function advanceMatchday(state: SeasonState): { state: SeasonState; played: MatchResult[] } {
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
  const availability = applyMatchdayAvailability(state.availability, played, matchday);
  return {
    state: {
      ...state,
      results: [...state.results, ...played],
      currentMatchday: matchday + 1,
      availability,
    },
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
