import type { MatchResult } from '../match';
import type { AwardPlayer, AwardTeam, Pichichi, SeasonAwards, Zamora } from './types';

/**
 * PICHICHI — the league top scorer.
 *
 * Every `goal` event already carries its scorer (`playerId`/`playerName`), so the
 * award is a straight tally over the season's goal events; no goal is ever
 * attributed at random. The team credited is the one the scorer played for in
 * that match (home or away side of the result).
 *
 * Ties (same goal count) break deterministically by the lower `playerId`, so the
 * winner never depends on result/iteration order. Returns null when no goal was
 * scored all season.
 */
export function computePichichi(results: readonly MatchResult[]): Pichichi | null {
  return rankScorers(results)[0] ?? null;
}

/**
 * The FULL scorers table (the Pichichi race), best first. Same tally and
 * deterministic tiebreak as {@link computePichichi} — most goals first, ties
 * broken by the lower `playerId` — so `rankScorers(results)[0]` is the Pichichi.
 * Powers the season statistics screen's top-scorers list. Empty when no goal
 * has been scored.
 */
export function rankScorers(results: readonly MatchResult[]): Pichichi[] {
  const tally = new Map<string, { playerName: string; teamId: string; goals: number }>();
  for (const r of results) {
    for (const e of r.events) {
      if (e.type !== 'goal') continue;
      const teamId = e.team === 'home' ? r.homeId : r.awayId;
      const cur = tally.get(e.playerId);
      if (cur) cur.goals += 1;
      else tally.set(e.playerId, { playerName: e.playerName, teamId, goals: 1 });
    }
  }
  const rows: Pichichi[] = [];
  for (const [playerId, v] of tally) {
    rows.push({ playerId, playerName: v.playerName, teamId: v.teamId, goals: v.goals });
  }
  rows.sort((a, b) => b.goals - a.goals || a.playerId.localeCompare(b.playerId));
  return rows;
}

/** The team's "titular" keeper: the highest-media `esPortero`, ties by lower id. */
function primaryKeeper(team: AwardTeam): AwardPlayer | null {
  let best: AwardPlayer | null = null;
  for (const p of team.players) {
    if (!p.esPortero) continue;
    const better =
      !best || p.media > best.media || (p.media === best.media && p.id.localeCompare(best.id) < 0);
    if (better) best = p;
  }
  return best;
}

/**
 * ZAMORA — the keeper of the least-conceded side (best goals-against ratio).
 *
 * Match events don't record who kept goal, so the award is attributed to each
 * team's primary keeper (highest-media `esPortero`) — a deterministic, reasonable
 * stand-in for "the keeper who played". The winner is the side with the lowest
 * conceded-per-match ratio; over a full season every side has played the same
 * number of matches, so this reduces to fewest goals conceded.
 *
 * Ties break by fewer goals conceded, then more matches, then the lower `teamId`.
 * Returns null when nothing has been played or no team fields a keeper.
 */
export function computeZamora(
  results: readonly MatchResult[],
  teams: readonly AwardTeam[],
): Zamora | null {
  return rankKeepers(results, teams)[0] ?? null;
}

/**
 * The FULL keepers table (the Zamora race), best-defended first. Same conceded
 * tally, primary-keeper resolution and deterministic tiebreak as
 * {@link computeZamora} — lowest conceded-per-match ratio first, then fewer goals
 * conceded, then more matches, then the lower `teamId` — so
 * `rankKeepers(results, teams)[0]` is the Zamora. Powers the season statistics
 * screen's least-conceded list. A team is only listed once it has played and
 * fields a keeper.
 */
export function rankKeepers(
  results: readonly MatchResult[],
  teams: readonly AwardTeam[],
): Zamora[] {
  const stats = new Map<string, { conceded: number; matches: number }>();
  const bump = (teamId: string, conceded: number): void => {
    const s = stats.get(teamId) ?? { conceded: 0, matches: 0 };
    s.conceded += conceded;
    s.matches += 1;
    stats.set(teamId, s);
  };
  for (const r of results) {
    bump(r.homeId, r.awayGoals);
    bump(r.awayId, r.homeGoals);
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const rows: (Zamora & { ratio: number })[] = [];
  for (const [teamId, s] of stats) {
    if (s.matches === 0) continue;
    const team = teamById.get(teamId);
    if (!team) continue;
    const keeper = primaryKeeper(team);
    if (!keeper) continue;
    rows.push({
      playerId: keeper.id,
      playerName: keeper.nombre,
      teamId,
      goalsConceded: s.conceded,
      matches: s.matches,
      ratio: s.conceded / s.matches,
    });
  }
  rows.sort(
    (a, b) =>
      a.ratio - b.ratio ||
      a.goalsConceded - b.goalsConceded ||
      b.matches - a.matches ||
      a.teamId.localeCompare(b.teamId),
  );
  return rows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    teamId: r.teamId,
    goalsConceded: r.goalsConceded,
    matches: r.matches,
  }));
}

/** Compute both individual trophies for a season in one pass-friendly call. */
export function computeSeasonAwards(
  results: readonly MatchResult[],
  teams: readonly AwardTeam[],
): SeasonAwards {
  return {
    pichichi: computePichichi(results),
    zamora: computeZamora(results, teams),
  };
}
