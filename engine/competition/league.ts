import { createRng, hashSeed, type Rng } from '../rng';
import { generateDoubleRoundRobin, type Fixture } from '../calendar';
import { simulateMatch, type MatchResult } from '../match';
import { computeStandings, type Scoreline } from '../standings';
import type { CompetitionTeam, LeagueRunConfig, LeagueSeasonResult } from './types';

/** Deterministic Fisher-Yates shuffle. */
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const ai = a[i];
    const aj = a[j];
    if (ai !== undefined && aj !== undefined) {
      a[i] = aj;
      a[j] = ai;
    }
  }
  return a;
}

/** Team order for the calendar, shuffled deterministically from the league seed. */
export function buildCalendar(teamIds: readonly string[], leagueSeed: number): Fixture[] {
  const rng = createRng(hashSeed(leagueSeed, 'calendar'));
  return generateDoubleRoundRobin(shuffle(teamIds, rng));
}

/** Stable per-match seed so a fixture always plays out the same way. */
export function fixtureSeed(leagueSeed: number, fixture: Fixture): number {
  return hashSeed(leagueSeed, fixture.round, fixture.homeId, fixture.awayId);
}

/** Simulate a single fixture given the participating teams. */
export function simulateFixture(
  home: CompetitionTeam,
  away: CompetitionTeam,
  leagueSeed: number,
  fixture: Fixture,
): MatchResult {
  return simulateMatch({ home, away, seed: fixtureSeed(leagueSeed, fixture) });
}

function toScoreline(r: MatchResult): Scoreline {
  return { homeId: r.homeId, awayId: r.awayId, homeGoals: r.homeGoals, awayGoals: r.awayGoals };
}

/** Simulate an entire league season and return fixtures, results, table and relegated teams. */
export function runLeagueSeason(
  teams: readonly CompetitionTeam[],
  config: LeagueRunConfig,
): LeagueSeasonResult {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const fixtures = buildCalendar([...byId.keys()], config.seed);

  const results: MatchResult[] = [];
  for (const fixture of fixtures) {
    const home = byId.get(fixture.homeId);
    const away = byId.get(fixture.awayId);
    if (!home || !away) {
      throw new Error(`Fixture references unknown team: ${fixture.homeId} vs ${fixture.awayId}`);
    }
    results.push(simulateFixture(home, away, config.seed, fixture));
  }

  const order = [...byId.keys()];
  const standings = computeStandings(order, results.map(toScoreline), config.pointsForWin);
  const relegated =
    config.relegationSpots > 0
      ? standings.slice(standings.length - config.relegationSpots).map((r) => r.teamId)
      : [];

  return { order, fixtures, results, standings, relegated };
}
