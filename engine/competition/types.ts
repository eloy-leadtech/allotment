import type { MatchPlayer, Tactics } from '../match';
import type { Fixture } from '../calendar';
import type { MatchResult } from '../match';
import type { StandingRow } from '../standings';

export interface CompetitionTeam {
  id: string;
  nombre: string;
  players: MatchPlayer[];
  /** Optional tactics; the match engine reads this straight from the team. */
  tactics?: Tactics;
}

export interface LeagueRunConfig {
  relegationSpots: number;
  pointsForWin: 2 | 3;
  /** League-level seed; every match and the calendar derive from it. */
  seed: number;
}

export interface LeagueSeasonResult {
  /** Team ids in calendar order. */
  order: string[];
  fixtures: Fixture[];
  results: MatchResult[];
  standings: StandingRow[];
  relegated: string[];
}
