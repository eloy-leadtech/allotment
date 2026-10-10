import {
  buildCalendar,
  buildCalendarFromFixtures,
  simulateFixture,
  replayFixture,
  computeStandings,
  NEUTRAL_FORM,
  NEUTRAL_MORALE,
  FRESH_FATIGUE,
  type CompetitionTeam,
  type Fixture,
  type MatchPlayer,
  type MatchResult,
  type RealMatchInput,
  type Scoreline,
  type StandingRow,
} from '@engine';
import { getCalendarByLeagueId, type League, type Player, type Team, type SeasonCalendar } from '@data';
import {
  applyMatchdayAvailability,
  isAvailable,
  type AvailabilityMap,
  type MedicalStaff,
} from '../career/availability';
import { applyFormMorale } from './formMorale';
import { applyFatigue } from './fatigue';
import { applyInternationalBreak, type CallUpNotice } from './convocatorias';
import {
  applyDesireMorale,
  humanMatchdayContext,
  type DesireKind,
} from '../career/desires';

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
  /**
   * The human squad's individual wishes (deseos) this season, keyed by player id.
   * DERIVED from the season-start situation by the career layer (see
   * career/desires and seasonFromCareer), so it is re-derived on load, never
   * persisted. Absent for a bare (non-career) season, which then applies no drift.
   */
  humanDesires?: Readonly<Record<string, DesireKind>>;
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
 *
 * When `realFixtures` is given, the season follows the authentic historical
 * calendar (pairings + dates + real scores); otherwise it falls back to the
 * seeded round-robin. Omitting it keeps the previous behaviour byte-for-byte.
 */
export function newSeasonFromTeams(
  teams: CompetitionTeam[],
  meta: SeasonMeta,
  seed: number,
  realFixtures?: readonly RealMatchInput[],
): SeasonState {
  if (!teams.some((t) => t.id === meta.humanTeamId)) {
    throw new Error(`Human team ${meta.humanTeamId} is not in the league`);
  }
  const fixtures =
    realFixtures && realFixtures.length > 0
      ? buildCalendarFromFixtures(realFixtures)
      : buildCalendar(teams.map((t) => t.id), seed);
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

/**
 * Start a fresh season for a league, with the human managing `humanTeamId`.
 *
 * By default the season follows the authentic historical calendar when one is
 * committed for `league.id` (see `realCalendarFor`), otherwise the seeded
 * round-robin. Pass `realFixtures` to override: a list forces that calendar, and
 * an empty list `[]` forces the round-robin (used by tests that exercise the
 * generated schedule).
 */
export function newSeason(
  league: League,
  humanTeamId: string,
  seed: number,
  realFixtures?: readonly RealMatchInput[],
): SeasonState {
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
    realFixtures ?? realCalendarFor(league.id),
  );
}

/** Map a committed season calendar into the engine's real-fixture input. */
function toRealFixtures(cal: SeasonCalendar): RealMatchInput[] {
  return cal.partidos.map((p) => ({
    round: p.jornada,
    homeId: p.homeId,
    awayId: p.awayId,
    date: p.fechaISO,
    homeGoals: p.homeGoals,
    awayGoals: p.awayGoals,
  }));
}

/**
 * The authentic calendar for a league id as engine fixture input, or `undefined`
 * when none is committed (the caller then gets the round-robin fallback). This is
 * the seam the new-game/career wiring will use:
 * `newSeason(league, humanTeamId, seed, realCalendarFor(league.id))`.
 */
export function realCalendarFor(leagueId: string): RealMatchInput[] | undefined {
  const cal = getCalendarByLeagueId(leagueId);
  return cal ? toRealFixtures(cal) : undefined;
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
  // Capture what the HUMAN team did this matchday (the fielded XI + result) for the
  // wish-driven morale drift below; a bye leaves this as "did not play".
  let humanXI: CompetitionTeam | undefined;
  let humanGoals: number | undefined;
  let humanRivalGoals: number | undefined;
  for (const fixture of fixturesForMatchday(state, matchday)) {
    const home = byId.get(fixture.homeId);
    const away = byId.get(fixture.awayId);
    if (!home || !away) {
      throw new Error(`Fixture references unknown team: ${fixture.homeId} vs ${fixture.awayId}`);
    }
    const homeXI = fieldableTeam(home, state.availability, matchday);
    const awayXI = fieldableTeam(away, state.availability, matchday);
    // Real-calendar seasons replay the authentic score for every match that does
    // NOT involve the human club (the table then tracks real history); the human's
    // own match is still simulated by seed. Round-robin fixtures carry no
    // `historicalScore`, so they always simulate — identical to the old behaviour.
    const isHumanMatch =
      fixture.homeId === state.humanTeamId || fixture.awayId === state.humanTeamId;
    const result =
      !isHumanMatch && fixture.historicalScore
        ? replayFixture(fixture)
        : simulateFixture(homeXI, awayXI, state.seed, fixture);
    played.push(result);
    if (fixture.homeId === state.humanTeamId) {
      humanXI = homeXI;
      humanGoals = result.homeGoals;
      humanRivalGoals = result.awayGoals;
    } else if (fixture.awayId === state.humanTeamId) {
      humanXI = awayXI;
      humanGoals = result.awayGoals;
      humanRivalGoals = result.homeGoals;
    }
  }
  const availability = applyMatchdayAvailability(state.availability, played, matchday, state.medical);
  // Evolve form/morale and fatigue from the matchday just played (deterministic:
  // replaying the season from its neutral/fresh start always rebuilds the same
  // values, so neither has to be persisted). Fatigue after so it reads the same
  // fielded XI; the two updates touch independent player fields.
  let evolved = applyFatigue(applyFormMorale(state.teams, played), played);
  // Layer the individual-wish morale drift on top (human team only). Derived from
  // the season's own humanDesires, so it too is reconstructed by the replay; absent
  // for a bare season, in which case this is a no-op.
  if (state.humanDesires) {
    const ctx = humanMatchdayContext(humanXI, humanGoals, humanRivalGoals);
    evolved = applyDesireMorale(evolved, state.humanTeamId, state.humanDesires, ctx);
  }
  // On a national-team parón matchday the internationals return with extra fatigue
  // stacked on top; a no-op on every other matchday. Deterministic and unpersisted
  // just like fatigue, so the replay reconstructs it identically.
  const { teams, notice } = applyInternationalBreak(evolved, {
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
