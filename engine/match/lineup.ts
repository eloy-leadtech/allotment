import type { MatchPlayer } from './types';

/**
 * Pick a starting XI: the best available goalkeeper plus the ten highest-rated
 * outfield players. Deterministic (sorts by rating, then id as a stable tiebreak).
 */
export function selectStartingXI(players: readonly MatchPlayer[]): MatchPlayer[] {
  if (players.length < 11) {
    throw new Error(`A lineup needs at least 11 players, got ${players.length}`);
  }
  const byRating = (a: MatchPlayer, b: MatchPlayer): number =>
    b.media - a.media || a.id.localeCompare(b.id);

  const keepers = players.filter((p) => p.esPortero).sort(byRating);
  const outfield = players.filter((p) => !p.esPortero).sort(byRating);

  const goalkeeper = keepers[0] ?? outfield[0];
  if (!goalkeeper) {
    throw new Error('No goalkeeper candidate found');
  }
  const fieldPlayers = outfield.filter((p) => p.id !== goalkeeper.id).slice(0, 10);
  const xi = [goalkeeper, ...fieldPlayers];
  if (xi.length < 11) {
    throw new Error(`Could not assemble 11 players, got ${xi.length}`);
  }
  return xi;
}
