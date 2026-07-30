import { hashSeed } from '@engine';
import type { League } from '@data';
import { newSeasonFromTeams, toMatchPlayer, type SeasonState } from '../season/season';
import type { CareerState, CareerTeam } from './types';
import { initialBudget } from './market';
import { seasonStartYear } from './development';

/** Everything `seasonFromCareer` needs (the career minus its derived season/history). */
type CareerMeta = Omit<CareerState, 'season' | 'history'>;

/** Derive the in-progress SeasonState from the career's full-data teams. */
export function seasonFromCareer(meta: CareerMeta): SeasonState {
  const teams = meta.teams.map((ct) => ({
    id: ct.id,
    nombre: ct.nombre,
    players: ct.players.map(toMatchPlayer),
  }));
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
  const meta: CareerMeta = {
    seed,
    leagueId: league.id,
    humanTeamId,
    seasonNumber: 1,
    temporada: league.temporada,
    pointsForWin: league.competicion.pointsForWin,
    relegationSpots: league.competicion.relegationSpots,
    budget: initialBudget(humanTeam, seasonStartYear(league.temporada)),
    teams,
  };
  return { ...meta, season: seasonFromCareer(meta), history: [] };
}

/** Resolve a team id to its display name in the career. */
export function careerTeamName(career: CareerState, teamId: string): string {
  return career.teams.find((t) => t.id === teamId)?.nombre ?? teamId;
}
