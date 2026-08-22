/**
 * Season-level orchestration of the fatigue mechanic: after a matchday is played,
 * roll each player's physical condition forward — the eleven who took the pitch
 * tire, everyone else recovers. Pure and deterministic (no RNG, driven only by
 * who played), so replaying a season from its fresh start always reconstructs
 * identical fatigue and nothing has to be persisted in the save.
 *
 * Mirrors `applyFormMorale`: same "which XI did each team field" derivation, kept
 * as a separate module so the two mechanics stay independently testable.
 */
import {
  selectStartingXI,
  updateTeamFatigue,
  type CompetitionTeam,
  type MatchPlayer,
  type MatchResult,
} from '@engine';

/** The starting XI a team fielded: its chosen XI, else the auto-selected best. */
function xiFor(team: CompetitionTeam): MatchPlayer[] {
  return team.tactics?.xi ?? selectStartingXI(team.players);
}

/**
 * Apply one matchday's fatigue evolution to the league's teams. Only teams that
 * actually played are touched; a team with an explicit XI keeps its `tactics.xi`
 * snapshot in sync with the freshly-updated players (as `applyFormMorale` does),
 * so the next match reads the current fatigue. Teams idle this round are
 * returned unchanged (they neither tire nor recover on a bye).
 */
export function applyFatigue(
  teams: readonly CompetitionTeam[],
  results: readonly MatchResult[],
): CompetitionTeam[] {
  if (results.length === 0) return [...teams];
  const byId = new Map(teams.map((t) => [t.id, t]));
  const playedIdsByTeam = new Map<string, Set<string>>();

  for (const result of results) {
    const home = byId.get(result.homeId);
    const away = byId.get(result.awayId);
    if (!home || !away) continue;
    playedIdsByTeam.set(home.id, new Set(xiFor(home).map((p) => p.id)));
    playedIdsByTeam.set(away.id, new Set(xiFor(away).map((p) => p.id)));
  }

  return teams.map((team) => {
    const playedIds = playedIdsByTeam.get(team.id);
    if (!playedIds) return team;
    const players = updateTeamFatigue(team.players, playedIds);
    if (team.tactics?.xi) {
      const updatedById = new Map(players.map((p) => [p.id, p]));
      const xi = team.tactics.xi.map((p) => updatedById.get(p.id) ?? p);
      return { ...team, players, tactics: { ...team.tactics, xi } };
    }
    return { ...team, players };
  });
}
