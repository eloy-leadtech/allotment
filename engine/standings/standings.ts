import type { Scoreline, StandingRow } from './types';

/**
 * Build the league table from a set of played scorelines.
 *
 * Ordering: points, then goal difference, then goals for, then teamId (a stable,
 * deterministic final tiebreak). NOTE: real La Liga breaks ties by head-to-head
 * first; that refinement is deferred — goal difference keeps the table
 * deterministic and is enough for the current milestone.
 */
export function computeStandings(
  teamIds: readonly string[],
  results: readonly Scoreline[],
  pointsForWin: 2 | 3,
): StandingRow[] {
  const table = new Map<string, StandingRow>();
  for (const teamId of teamIds) {
    table.set(teamId, {
      teamId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const r of results) {
    const home = table.get(r.homeId);
    const away = table.get(r.awayId);
    if (!home || !away) {
      throw new Error(`Result references unknown team: ${r.homeId} vs ${r.awayId}`);
    }
    home.played += 1;
    away.played += 1;
    home.goalsFor += r.homeGoals;
    home.goalsAgainst += r.awayGoals;
    away.goalsFor += r.awayGoals;
    away.goalsAgainst += r.homeGoals;
    if (r.homeGoals > r.awayGoals) {
      home.won += 1;
      away.lost += 1;
      home.points += pointsForWin;
    } else if (r.homeGoals < r.awayGoals) {
      away.won += 1;
      home.lost += 1;
      away.points += pointsForWin;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...table.values()];
  for (const row of rows) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamId.localeCompare(b.teamId),
  );
  return rows;
}
