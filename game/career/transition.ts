/**
 * Historical season transition with KEEP/RELEASE decisions — the heart of
 * "the world follows history, but your team is yours".
 *
 * When you advance to the next season, every AI club adopts its REAL roster for
 * that year. Your club is different: the players history would take away are
 * shown to you, and you may RETAIN any of them (they stay, aged one season, and
 * are removed from the club history sent them to, so nobody is duplicated).
 * Incoming historical transfers to your club are accepted by default, keeping
 * your squad realistic.
 *
 * Pure and deterministic: retained players age via the seeded development curve.
 */
import { computeStandings, type StandingRow } from '@engine';
import type { League, Player } from '@data';
import type { CareerState, CareerTeam } from './types';
import { seasonFromCareer } from './career';
import { developPlayer, seasonStartYear } from './development';

/** Club-independent identity for the same real person across seasons/clubs. */
function personKey(p: Player): string {
  return `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;
}

/** Turn a next-year real League into career teams (full player data). */
function worldTeams(nextWorld: League): CareerTeam[] {
  return nextWorld.equipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    colores: t.colores,
    players: t.jugadores,
  }));
}

/** The winner of the just-finished season (current leader if unfinished). */
function championOf(career: CareerState): string {
  const table: StandingRow[] = computeStandings(
    career.season.teams.map((t) => t.id),
    career.season.results.map((r) => ({
      homeId: r.homeId,
      awayId: r.awayId,
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
    })),
    career.season.pointsForWin,
  );
  return table[0]?.teamId ?? career.humanTeamId;
}

export interface TransitionPreview {
  temporadaActual: string;
  temporadaSiguiente: string;
  championId: string;
  /** Your current players history would take away (candidates to RETAIN). */
  departures: Player[];
  /** Players history brings to your club next year (accepted by default). */
  arrivals: Player[];
}

/** Your club's real roster for the next season, or [] if the club is absent. */
function yourNextReal(nextWorld: League, humanTeamId: string): Player[] {
  return nextWorld.equipos.find((t) => t.id === humanTeamId)?.jugadores ?? [];
}

/**
 * Preview the historical transition for the human club: who would leave (to
 * retain) and who would arrive. Read-only; makes no decisions.
 */
export function previewTransition(career: CareerState, nextWorld: League): TransitionPreview {
  const current = career.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const nextReal = yourNextReal(nextWorld, career.humanTeamId);
  const nextIds = new Set(nextReal.map((p) => p.id));
  const currentIds = new Set(current.map((p) => p.id));
  return {
    temporadaActual: career.temporada,
    temporadaSiguiente: nextWorld.temporada,
    championId: championOf(career),
    departures: current.filter((p) => !nextIds.has(p.id)),
    arrivals: nextReal.filter((p) => !currentIds.has(p.id)),
  };
}

/**
 * Advance the career one season into the real `nextWorld`.
 *
 * - AI clubs adopt their real next-year roster.
 * - Your club = your real next-year roster + the departures you chose to RETAIN
 *   (aged one season via the development curve; retirees drop out). Retained
 *   players are removed from whichever club history sent them to (no duplicates).
 *
 * `retainIds` holds current-squad player ids to keep. Ids not among the actual
 * departures are ignored.
 */
export function applyTransition(
  career: CareerState,
  nextWorld: League,
  retainIds: ReadonlySet<string>,
): CareerState {
  if (nextWorld.competicion.kind !== 'league') {
    throw new Error('applyTransition supports league competitions only');
  }
  const seasonNumberNext = career.seasonNumber + 1;
  const temporadaNext = nextWorld.temporada;
  const startYear = seasonStartYear(temporadaNext);

  const preview = previewTransition(career, nextWorld);
  const retained = preview.departures.filter((p) => retainIds.has(p.id));

  // Age each retained player one season; drop those who retire.
  const developedRetained: Player[] = [];
  for (const player of retained) {
    const result = developPlayer(player, {
      seed: career.seed,
      seasonNumber: seasonNumberNext,
      seasonStartYear: startYear,
    });
    if (!result.retired) developedRetained.push(result.player);
  }
  const retainedKeys = new Set(retained.map(personKey));

  const base = worldTeams(nextWorld);
  const teams: CareerTeam[] = base.map((team) => {
    if (team.id === career.humanTeamId) {
      // Your real next roster plus the retained (aged) players.
      return { ...team, players: [...team.players, ...developedRetained] };
    }
    // Remove any retained player history would have moved to this club.
    if (retainedKeys.size === 0) return team;
    return { ...team, players: team.players.filter((p) => !retainedKeys.has(personKey(p))) };
  });

  const meta = {
    seed: career.seed,
    leagueId: nextWorld.id,
    humanTeamId: career.humanTeamId,
    seasonNumber: seasonNumberNext,
    temporada: temporadaNext,
    pointsForWin: nextWorld.competicion.pointsForWin,
    relegationSpots: nextWorld.competicion.relegationSpots,
    // Budget carries over untouched; the market phase is what moves it.
    budget: career.budget,
    teams,
  };

  return {
    ...meta,
    season: seasonFromCareer(meta),
    history: [
      ...career.history,
      {
        seasonNumber: career.seasonNumber,
        temporada: career.temporada,
        championId: preview.championId,
      },
    ],
  };
}
