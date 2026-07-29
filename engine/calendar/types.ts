/** A single scheduled match. Round is 1-indexed. */
export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
}
