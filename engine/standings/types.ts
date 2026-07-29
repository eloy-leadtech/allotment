/** Final score of a played match. */
export interface Scoreline {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
}

/** One row of a league table. */
export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}
