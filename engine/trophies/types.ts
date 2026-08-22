/**
 * Individual season trophies, the classic PC Fútbol pair:
 *   - PICHICHI: the league's top scorer.
 *   - ZAMORA: the keeper of the least-conceded side (best goals-against ratio).
 *
 * Both are DERIVED from the season's match results (and, for the Zamora, the
 * rosters so the concrete keeper can be named). Nothing here is random: the same
 * results always yield the same winners, with deterministic tiebreaks.
 */

/** The league's top scorer for a season. */
export interface Pichichi {
  playerId: string;
  playerName: string;
  /** Team the player scored those goals for. */
  teamId: string;
  goals: number;
}

/** The best-defended keeper for a season (fewest goals conceded per match). */
export interface Zamora {
  playerId: string;
  playerName: string;
  teamId: string;
  /** Goals the team conceded across the counted matches. */
  goalsConceded: number;
  matches: number;
}

/** Both individual trophies for a season; either is null when it can't be awarded. */
export interface SeasonAwards {
  pichichi: Pichichi | null;
  zamora: Zamora | null;
}

/**
 * Minimal player view the trophy computation needs. Both the engine's
 * `MatchPlayer` and the game's full `Player` are structurally assignable to it,
 * so callers pass whichever roster they already hold.
 */
export interface AwardPlayer {
  id: string;
  nombre: string;
  esPortero: boolean;
  media: number;
}

/** Minimal team view: an id and its roster (to resolve the Zamora keeper). */
export interface AwardTeam {
  id: string;
  players: readonly AwardPlayer[];
}
