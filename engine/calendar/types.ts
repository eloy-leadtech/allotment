/** A single scheduled match. Round is 1-indexed. */
export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
  /**
   * Real historical kick-off date (ISO `yyyy-mm-dd`). Present only when the
   * calendar was built from authentic data (`buildCalendarFromFixtures`); absent
   * for a generated round-robin. It is metadata for the UI and NEVER feeds the
   * per-match seed, so adding it leaves simulated results byte-for-byte identical.
   */
  date?: string;
  /**
   * Real historical final score. Present only for authentic calendars. The season
   * replays it for every match that does NOT involve the human club (so the table
   * tracks real history), while the human's own match is still simulated by seed.
   */
  historicalScore?: {
    homeGoals: number;
    awayGoals: number;
  };
}
