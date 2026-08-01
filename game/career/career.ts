import { hashSeed, type CompetitionTeam, type MatchPlayer, type Tactics } from '@engine';
import type { League } from '@data';
import { newSeasonFromTeams, toMatchPlayer, type SeasonState } from '../season/season';
import type { CareerState, CareerTactics, CareerTeam } from './types';
import { DEFAULT_TRAINING_FOCUS, type TrainingState } from './training';
import { initialBudget } from './market';
import { DEFAULT_STADIUM } from './stadium';
import { DEFAULT_SPONSOR } from './sponsors';
import { DEFAULT_CREDIT } from './credit';
import { seasonStartYear } from './development';
import { initialContracts } from './contracts';
import { generateYouthBatch } from './cantera';
import { computeSeasonObjective } from './board';

/** Everything `seasonFromCareer` needs (the career minus its derived season/history/palmarés). */
type CareerMeta = Omit<CareerState, 'season' | 'history' | 'palmares'>;

/**
 * Build the engine tactics for a match team from career tactics: resolve the
 * chosen XI ids against the squad; drop the XI (auto-select) if fewer than 11
 * resolve (e.g. a player was sold), keeping the formation either way.
 */
export function tacticsForSquad(
  tactics: CareerTactics | undefined,
  players: readonly MatchPlayer[],
): Tactics | undefined {
  if (!tactics) return undefined;
  if (!tactics.xiIds) return { formation: tactics.formation };
  const byId = new Map(players.map((p) => [p.id, p]));
  const xi = tactics.xiIds.map((id) => byId.get(id)).filter((p): p is MatchPlayer => p !== undefined);
  return xi.length === 11 ? { formation: tactics.formation, xi } : { formation: tactics.formation };
}

/** Derive the in-progress SeasonState from the career's full-data teams. */
export function seasonFromCareer(meta: CareerMeta): SeasonState {
  const teams: CompetitionTeam[] = meta.teams.map((ct) => {
    const players = ct.players.map(toMatchPlayer);
    if (ct.id === meta.humanTeamId && meta.tactics) {
      return { id: ct.id, nombre: ct.nombre, players, tactics: tacticsForSquad(meta.tactics, players) };
    }
    return { id: ct.id, nombre: ct.nombre, players };
  });
  // Each career season gets its own deterministic seed derived from the master seed.
  const seed = hashSeed(meta.seed, 'season', meta.seasonNumber);
  return newSeasonFromTeams(
    teams,
    {
      leagueId: meta.leagueId,
      temporada: meta.temporada,
      humanTeamId: meta.humanTeamId,
      pointsForWin: meta.pointsForWin,
      relegationSpots: meta.relegationSpots,
    },
    seed,
  );
}

/** Start a new career: the human manages `humanTeamId` from season 1. */
export function newCareer(league: League, humanTeamId: string, seed: number): CareerState {
  if (league.competicion.kind !== 'league') {
    throw new Error('newCareer currently supports league competitions only');
  }
  const teams: CareerTeam[] = league.equipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    colores: t.colores,
    players: t.jugadores,
  }));
  const humanTeam = teams.find((t) => t.id === humanTeamId);
  if (!humanTeam) {
    throw new Error(`Human team ${humanTeamId} is not in the league`);
  }
  const relegationSpots = league.competicion.relegationSpots;
  const meta: CareerMeta = {
    seed,
    leagueId: league.id,
    humanTeamId,
    seasonNumber: 1,
    temporada: league.temporada,
    pointsForWin: league.competicion.pointsForWin,
    relegationSpots,
    division: 'primera',
    board: {
      objective: computeSeasonObjective({
        teams,
        division: 'primera',
        humanTeamId,
        relegationSpots,
      }),
    },
    // A fresh career trains with a balanced focus until the manager changes it.
    training: { focus: DEFAULT_TRAINING_FOCUS },
    budget: initialBudget(humanTeam, seasonStartYear(league.temporada)),
    // A fresh career starts with the base ground; enlarge it to grow the taquilla.
    stadium: DEFAULT_STADIUM,
    // A fresh career signs the basic sponsor until the manager picks a better offer.
    sponsor: DEFAULT_SPONSOR,
    // A fresh career is debt-free; the board grants credit once you overspend.
    credit: DEFAULT_CREDIT,
    teams,
    // Every squad player starts on a deal derived from their market value.
    contracts: initialContracts(humanTeam.players, seed, 1, seasonStartYear(league.temporada)),
    // Season 1's opening hornada of juveniles.
    youthProspects: generateYouthBatch({
      seed,
      seasonNumber: 1,
      temporada: league.temporada,
      humanTeamId,
    }),
    // A fresh career has ojeado no rival yet; reports build as you assign scouts.
    scouting: {},
  };
  return { ...meta, season: seasonFromCareer(meta), history: [], palmares: [] };
}

/** Resolve a team id to its display name in the career. */
export function careerTeamName(career: CareerState, teamId: string): string {
  return career.teams.find((t) => t.id === teamId)?.nombre ?? teamId;
}

/**
 * Set the human's tactics. Updates the in-progress season's human team in place
 * (so it takes effect from the next matchday) WITHOUT resetting results or the
 * current matchday — changing tactics never replays what's already been played.
 */
export function setCareerTactics(career: CareerState, tactics: CareerTactics): CareerState {
  const teams = career.season.teams.map((t) =>
    t.id === career.humanTeamId ? { ...t, tactics: tacticsForSquad(tactics, t.players) } : t,
  );
  return { ...career, tactics, season: { ...career.season, teams } };
}

/**
 * Set the human's training focus for the season. This shapes how your squad's
 * attributes develop at the NEXT season transition (see development.ts), so it
 * never touches the in-progress season's results or matchday — nothing already
 * played is replayed.
 */
export function setCareerTraining(career: CareerState, training: TrainingState): CareerState {
  return { ...career, training };
}
