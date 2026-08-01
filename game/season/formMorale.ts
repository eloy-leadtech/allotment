/**
 * Season-level orchestration of the form/morale mechanic: after a matchday is
 * played, roll each team's players forward using the pure engine update. Pure
 * and deterministic — no RNG, driven only by the results — so replaying a season
 * from its neutral start always reconstructs identical form/morale.
 */
import {
  selectStartingXI,
  updateTeamFormMorale,
  type CompetitionTeam,
  type MatchPlayer,
  type MatchResult,
} from '@engine';

/** The starting XI a team fielded: its chosen XI, else the auto-selected best. */
function xiFor(team: CompetitionTeam): MatchPlayer[] {
  return team.tactics?.xi ?? selectStartingXI(team.players);
}

/** Goals scored per player id by one side of a match, from the goal events. */
function goalsByPlayer(result: MatchResult, side: 'home' | 'away'): Map<string, number> {
  const goals = new Map<string, number>();
  for (const e of result.events) {
    if (e.type === 'goal' && e.team === side) {
      goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
    }
  }
  return goals;
}

/** One team's post-match update: who played, its goals for/against, its scorers. */
interface TeamUpdate {
  playedIds: Set<string>;
  teamGoals: number;
  rivalGoals: number;
  goals: Map<string, number>;
}

/**
 * Apply the form/morale evolution of one matchday to the league's teams. Only
 * teams that actually played are touched; their `players` (and, for a team with
 * an explicit XI, the `tactics.xi` snapshot) are updated in lockstep so the next
 * match reads the fresh values. Teams with no match this round are returned as-is.
 */
export function applyFormMorale(
  teams: readonly CompetitionTeam[],
  results: readonly MatchResult[],
): CompetitionTeam[] {
  if (results.length === 0) return [...teams];
  const byId = new Map(teams.map((t) => [t.id, t]));
  const updates = new Map<string, TeamUpdate>();

  for (const result of results) {
    const home = byId.get(result.homeId);
    const away = byId.get(result.awayId);
    if (!home || !away) continue;
    updates.set(home.id, {
      playedIds: new Set(xiFor(home).map((p) => p.id)),
      teamGoals: result.homeGoals,
      rivalGoals: result.awayGoals,
      goals: goalsByPlayer(result, 'home'),
    });
    updates.set(away.id, {
      playedIds: new Set(xiFor(away).map((p) => p.id)),
      teamGoals: result.awayGoals,
      rivalGoals: result.homeGoals,
      goals: goalsByPlayer(result, 'away'),
    });
  }

  return teams.map((team) => {
    const upd = updates.get(team.id);
    if (!upd) return team;
    const players = updateTeamFormMorale(
      team.players,
      upd.playedIds,
      upd.teamGoals,
      upd.rivalGoals,
      upd.goals,
    );
    // Keep an explicit XI snapshot in sync with the freshly-updated players.
    if (team.tactics?.xi) {
      const updatedById = new Map(players.map((p) => [p.id, p]));
      const xi = team.tactics.xi.map((p) => updatedById.get(p.id) ?? p);
      return { ...team, players, tactics: { ...team.tactics, xi } };
    }
    return { ...team, players };
  });
}
