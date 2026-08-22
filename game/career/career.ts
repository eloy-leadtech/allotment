import { hashSeed, type CompetitionTeam, type MatchPlayer, type Tactics } from '@engine';
import type { League } from '@data';
import { newSeasonFromTeams, toMatchPlayer, type SeasonState } from '../season/season';
import type { MedicalStaff } from './availability';
import type { CareerState, CareerTactics, CareerTeam } from './types';
import { DEFAULT_TRAINING_FOCUS, type TrainingState } from './training';
import {
  DEFAULT_STAFF,
  assistantPerformanceBonus,
  medicalRecoveryFactor,
} from './staff';
import { initialBudget } from './market';
import { DEFAULT_STADIUM } from './stadium';
import { DEFAULT_SPONSOR } from './sponsors';
import { DEFAULT_CREDIT } from './credit';
import { DEFAULT_LOANS } from './loans';
import { seasonStartYear } from './development';
import { initialContracts } from './contracts';
import { DEFAULT_RENEWALS } from './renewals';
import { generateYouthBatch } from './cantera';
import { computeSeasonObjective } from './board';
import { DEFAULT_CONFIANZA } from './confianza';
import { DEFAULT_WINTER, reverseWinterMovements } from './winterMovements';

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

/** A clamped 0-99 rating (integer), matching the classic scale. */
const clampRating = (v: number): number => Math.max(0, Math.min(99, Math.round(v)));

/**
 * Apply the segundo entrenador's flat performance bonus to one match player: it
 * lifts the media and the on-pitch attributes the engine reads, so your side plays
 * a touch better. Never mutates the input; clamped to the 0-99 scale.
 */
function boostMatchPlayer(p: MatchPlayer, bonus: number): MatchPlayer {
  return {
    ...p,
    media: clampRating(p.media + bonus),
    remate: clampRating(p.remate + bonus),
    ofensivo: clampRating(p.ofensivo + bonus),
    pase: clampRating(p.pase + bonus),
    entrada: clampRating(p.entrada + bonus),
    porteria: clampRating(p.porteria + bonus),
  };
}

/**
 * Derive the in-progress SeasonState from the career's full-data teams.
 *
 * `meta.teams` is the CURRENT (post-winter) squad. To keep the winter market from
 * rewriting the first half, we build the FRESH season from the PRE-winter rosters
 * (the movements undone), so replaying jornadas 1..(window-1) reproduces exactly
 * what was played. The winter-aware replay (see winterMarket.ts) then re-applies
 * the movements at the window matchday, so the second half uses the new squads.
 * With no winter movements this is the plain post-winter derivation as before.
 *
 * The technical staff also shapes the derived season: the segundo entrenador lifts
 * the human squad's match rating (boostMatchPlayer) and, further down, the médico
 * shortens the human squad's injuries (SeasonState.medical) — both on top of the
 * winter derivation.
 */
export function seasonFromCareer(meta: CareerMeta): SeasonState {
  // Winter market: build the FRESH season from the PRE-winter rosters (movements undone).
  const movements = meta.winter?.movements ?? [];
  const baseTeams = movements.length ? reverseWinterMovements(meta.teams, movements) : meta.teams;
  // The segundo entrenador lifts the human squad's match rating (0 = no segundo).
  const bonus = assistantPerformanceBonus(meta.staff);
  const teams: CompetitionTeam[] = baseTeams.map((ct) => {
    const isHuman = ct.id === meta.humanTeamId;
    let players = ct.players.map(toMatchPlayer);
    if (isHuman && bonus > 0) players = players.map((p) => boostMatchPlayer(p, bonus));
    if (isHuman && meta.tactics) {
      return { id: ct.id, nombre: ct.nombre, players, tactics: tacticsForSquad(meta.tactics, players) };
    }
    return { id: ct.id, nombre: ct.nombre, players };
  });
  // Each career season gets its own deterministic seed derived from the master seed.
  const seed = hashSeed(meta.seed, 'season', meta.seasonNumber);
  const season = newSeasonFromTeams(
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
  // The médico shortens injuries for the human squad (factor 1 = no médico → skip).
  const factor = medicalRecoveryFactor(meta.staff);
  if (factor >= 1) return season;
  const humanPlayers = meta.teams.find((t) => t.id === meta.humanTeamId)?.players ?? [];
  const medical: MedicalStaff = { playerIds: new Set(humanPlayers.map((p) => p.id)), factor };
  return { ...season, medical };
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
    // A fresh career starts with the board and the crowd neutral (50/50).
    confianza: DEFAULT_CONFIANZA,
    // A fresh career trains with a balanced focus until the manager changes it.
    training: { focus: DEFAULT_TRAINING_FOCUS },
    budget: initialBudget(humanTeam, seasonStartYear(league.temporada)),
    // A fresh career starts with the base ground; enlarge it to grow the taquilla.
    stadium: DEFAULT_STADIUM,
    // A fresh career signs the basic sponsor until the manager picks a better offer.
    sponsor: DEFAULT_SPONSOR,
    // A fresh career is debt-free; the board grants credit once you overspend.
    credit: DEFAULT_CREDIT,
    // A fresh career has nobody out or in on loan.
    loans: DEFAULT_LOANS,
    // A fresh career has an untouched winter window (opens at the season midpoint).
    winter: DEFAULT_WINTER,
    // A fresh career starts with no technical staff; hire them in the despacho.
    staff: DEFAULT_STAFF,
    teams,
    // Every squad player starts on a deal derived from their market value.
    contracts: initialContracts(humanTeam.players, seed, 1, seasonStartYear(league.temporada)),
    // A fresh career has resolved no renewal negotiations yet.
    renewals: DEFAULT_RENEWALS,
    // Season 1's opening hornada of juveniles.
    youthProspects: generateYouthBatch({
      seed,
      seasonNumber: 1,
      temporada: league.temporada,
      humanTeamId,
    }),
    // A fresh career has ojeado no rival yet; reports build as you assign scouts.
    scouting: {},
    // A fresh career follows no rival promesa yet; the list builds as you seguir them.
    prospectTracking: {},
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
