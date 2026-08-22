/**
 * Rueda de prensa interactiva — the press-conference mechanic.
 *
 * At key moments (before a matchday, after a winning or losing run, after a
 * thrashing) the press puts a QUESTION to the manager with 2-3 possible ANSWERS.
 * Each answer nudges two existing systems: the dressing-room MORALE (the squad's
 * `morale`, from engine/match/morale) and the BOARD's satisfaction with the
 * manager (see board.ts). Answers are moderate on purpose — they never distort the
 * ~2.6 goals/game balance.
 *
 * Architecture: an answer is a PLAYER DECISION, not derivable by replaying the
 * season's results, so it is PERSISTED on the career (`press.answers`, see
 * types.ts) and re-applied deterministically on load. Morale bumps are keyed to
 * the matchday they were taken at and interleaved back into the replay
 * (`replaySeasonWithPress`) so a loaded career reconstructs the live one exactly;
 * the board effect is a pure sum over the answer log.
 *
 * Which question appears is chosen DETERMINISTICALLY from the seed and matchday
 * (no RNG), so the same career always offers the same question at the same moment.
 * Pure and framework-free: no React, no browser.
 */
import { hashSeed, clampScore, playerMorale } from '@engine';
import { advanceMatchday, isSeasonOver, type SeasonState } from '../season/season';
import type { CareerState, PressAnswer } from './types';
import type { Satisfaction } from './board';

/** The match situation that frames a press question. */
export type PressSituation =
  | 'season-start' // no matches played yet
  | 'good-run' // three or more straight wins
  | 'bad-run' // three or more straight losses
  | 'big-win' // last match won by 3+
  | 'big-loss' // last match lost by 3+
  | 'routine'; // anything else

/** The effect of one answer: a nudge to squad morale and to board satisfaction. */
export interface PressEffect {
  /** Delta applied to every human player's morale (points, [0,100] scale). */
  morale: number;
  /** Delta applied to the board's press standing (small integer). */
  board: number;
}

/** One possible answer to a press question. */
export interface PressOption {
  id: string;
  text: string;
  effect: PressEffect;
}

/** A press question: a prompt tied to a situation, with 2-3 answers. */
export interface PressQuestion {
  id: string;
  situation: PressSituation;
  prompt: string;
  options: PressOption[];
}

/** A concrete question offered for a specific matchday. */
export interface PressQuestionInstance {
  matchday: number;
  question: PressQuestion;
}

/**
 * The question bank. Every option trades morale against board favour in the
 * classic PC Fútbol style: defend the players and the dressing room warms to you
 * but the board bristles; blame the players and it is the other way round.
 * Effects are deliberately small (morale in [-3,3], board in [-1,2]).
 */
export const PRESS_QUESTIONS: readonly PressQuestion[] = [
  {
    id: 'q-start-objetivo',
    situation: 'season-start',
    prompt: '¿Qué objetivo se marca el equipo para esta temporada?',
    options: [
      { id: 'ambicioso', text: 'Vamos a pelear por todo', effect: { morale: 3, board: 2 } },
      { id: 'prudente', text: 'Iremos partido a partido', effect: { morale: 1, board: 1 } },
      { id: 'modesto', text: 'Somos un equipo humilde', effect: { morale: -1, board: 0 } },
    ],
  },
  {
    id: 'q-routine-afronta',
    situation: 'routine',
    prompt: '¿Cómo afronta el equipo la próxima jornada?',
    options: [
      { id: 'confianza', text: 'Con la máxima confianza', effect: { morale: 2, board: 1 } },
      { id: 'respeto', text: 'Con respeto al rival', effect: { morale: 1, board: 1 } },
      { id: 'exigente', text: 'Tenemos que mejorar mucho', effect: { morale: -2, board: 1 } },
    ],
  },
  {
    id: 'q-routine-vestuario',
    situation: 'routine',
    prompt: 'La prensa pregunta por el ambiente del vestuario.',
    options: [
      { id: 'unido', text: 'El grupo está fuerte y unido', effect: { morale: 2, board: 1 } },
      { id: 'silencio', text: 'Trabajamos en silencio', effect: { morale: 1, board: 0 } },
      { id: 'falta', text: 'Le falta ambición al grupo', effect: { morale: -2, board: 1 } },
    ],
  },
  {
    id: 'q-goodrun-arriba',
    situation: 'good-run',
    prompt: 'Encadenáis varias victorias, ¿os veis peleando arriba?',
    options: [
      { id: 'titulo', text: 'Vamos a por el título', effect: { morale: 3, board: 2 } },
      { id: 'pies', text: 'Pies en el suelo', effect: { morale: 1, board: 1 } },
      { id: 'nada', text: 'Aún no hemos hecho nada', effect: { morale: 0, board: 2 } },
    ],
  },
  {
    id: 'q-badrun-puesto',
    situation: 'bad-run',
    prompt: 'Racha de derrotas, ¿teme por su puesto?',
    options: [
      { id: 'defiendo', text: 'Doy la cara por mis jugadores', effect: { morale: 3, board: -1 } },
      { id: 'asumo', text: 'Asumo toda la responsabilidad', effect: { morale: 1, board: 2 } },
      { id: 'senalo', text: 'El equipo no está compitiendo', effect: { morale: -3, board: 1 } },
    ],
  },
  {
    id: 'q-bigloss-goleada',
    situation: 'big-loss',
    prompt: 'Dura goleada encajada, ¿qué explicación da?',
    options: [
      { id: 'arropo', text: 'Voy a arropar al equipo', effect: { morale: 3, board: -1 } },
      { id: 'autocritica', text: 'Toca hacer autocrítica', effect: { morale: -1, board: 1 } },
      { id: 'inaceptable', text: 'Es inaceptable, habrá cambios', effect: { morale: -3, board: 2 } },
    ],
  },
  {
    id: 'q-bigwin-mensaje',
    situation: 'big-win',
    prompt: 'Goleada a favor, ¿qué mensaje manda al vestuario?',
    options: [
      { id: 'seguir', text: 'Enorme, a seguir en esta línea', effect: { morale: 3, board: 1 } },
      { id: 'humildad', text: 'Disfrutar, pero con humildad', effect: { morale: 2, board: 1 } },
      { id: 'exigir', text: 'No vale de nada si no seguimos', effect: { morale: 0, board: 2 } },
    ],
  },
];

/** Look up a question by id. */
export function findPressQuestion(questionId: string): PressQuestion | undefined {
  return PRESS_QUESTIONS.find((q) => q.id === questionId);
}

/** The season's recorded answers (empty for a pre-rueda or fresh career). */
export function pressAnswers(career: CareerState): readonly PressAnswer[] {
  return career.press?.answers ?? [];
}

/** The human's results so far, in played order, as win/draw/loss. */
function humanOutcomes(career: CareerState): ('win' | 'draw' | 'loss')[] {
  const humanId = career.humanTeamId;
  const out: ('win' | 'draw' | 'loss')[] = [];
  for (const r of career.season.results) {
    const home = r.homeId === humanId;
    const away = r.awayId === humanId;
    if (!home && !away) continue;
    const gf = home ? r.homeGoals : r.awayGoals;
    const ga = home ? r.awayGoals : r.homeGoals;
    out.push(gf > ga ? 'win' : gf < ga ? 'loss' : 'draw');
  }
  return out;
}

/** Goal margin (>=0) of the human's most recent match, or 0 if none played. */
function lastHumanMargin(career: CareerState): number {
  const humanId = career.humanTeamId;
  for (let i = career.season.results.length - 1; i >= 0; i -= 1) {
    const r = career.season.results[i];
    if (!r) continue;
    const home = r.homeId === humanId;
    const away = r.awayId === humanId;
    if (!home && !away) continue;
    const gf = home ? r.homeGoals : r.awayGoals;
    const ga = home ? r.awayGoals : r.homeGoals;
    return Math.abs(gf - ga);
  }
  return 0;
}

/** Length of the trailing run of one outcome (e.g. current win streak). */
function trailingRun(outcomes: readonly ('win' | 'draw' | 'loss')[], kind: 'win' | 'loss'): number {
  let n = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === kind; i -= 1) n += 1;
  return n;
}

/** The press situation for the moment before the upcoming matchday. */
export function currentSituation(career: CareerState): PressSituation {
  const outcomes = humanOutcomes(career);
  if (outcomes.length === 0) return 'season-start';
  if (trailingRun(outcomes, 'win') >= 3) return 'good-run';
  if (trailingRun(outcomes, 'loss') >= 3) return 'bad-run';
  const last = outcomes[outcomes.length - 1];
  const margin = lastHumanMargin(career);
  if (last === 'loss' && margin >= 3) return 'big-loss';
  if (last === 'win' && margin >= 3) return 'big-win';
  return 'routine';
}

/**
 * The press question on offer right now, or null when there is none: the season
 * is over, or this matchday's conference has already been answered. The question
 * is picked deterministically from the seed, matchday and situation.
 */
export function selectPressQuestion(career: CareerState): PressQuestionInstance | null {
  const season = career.season;
  if (isSeasonOver(season)) return null;
  const matchday = season.currentMatchday;
  if (pressAnswers(career).some((a) => a.matchday === matchday)) return null;
  const situation = currentSituation(career);
  const candidates = PRESS_QUESTIONS.filter((q) => q.situation === situation);
  if (candidates.length === 0) return null;
  const idx = hashSeed(career.seed, 'press-question', matchday, situation) % candidates.length;
  const question = candidates[idx] ?? candidates[0];
  if (!question) return null;
  return { matchday, question };
}

/** The accumulated effect of the season's answers: total morale and board deltas. */
export function pressStanding(career: CareerState): PressEffect {
  let morale = 0;
  let board = 0;
  for (const a of pressAnswers(career)) {
    const option = findPressQuestion(a.questionId)?.options.find((o) => o.id === a.optionId);
    if (!option) continue;
    morale += option.effect.morale;
    board += option.effect.board;
  }
  return { morale, board };
}

/** How the board feels about the manager's handling of the press this season. */
export function pressBoardSatisfaction(career: CareerState): Satisfaction {
  const board = pressStanding(career).board;
  if (board >= 2) return 'contento';
  if (board <= -2) return 'enfadado';
  return 'normal';
}

/**
 * Apply a one-off morale delta to every human player in a season, clamped to
 * [0,100]. The chosen-XI snapshot (if any) is kept in lockstep so the next match
 * fields the bumped values. A zero delta returns the season untouched (identity),
 * which keeps a press-free replay byte-identical to the plain one.
 */
export function bumpSeasonMorale(
  season: SeasonState,
  humanTeamId: string,
  delta: number,
): SeasonState {
  if (delta === 0) return season;
  const teams = season.teams.map((team) => {
    if (team.id !== humanTeamId) return team;
    const players = team.players.map((p) => ({ ...p, morale: clampScore(playerMorale(p) + delta) }));
    if (team.tactics?.xi) {
      const byId = new Map(players.map((p) => [p.id, p]));
      const xi = team.tactics.xi.map(
        (p) => byId.get(p.id) ?? { ...p, morale: clampScore(playerMorale(p) + delta) },
      );
      return { ...team, players, tactics: { ...team.tactics, xi } };
    }
    return { ...team, players };
  });
  return { ...season, teams };
}

/**
 * The total morale bump from answers recorded AT a given matchday. Exported so the
 * winter-market replay (winterMarket.ts) can interleave the same press bumps while
 * also applying the winter roster swap at the window matchday.
 */
export function moraleDeltaAt(answers: readonly PressAnswer[], matchday: number): number {
  let delta = 0;
  for (const a of answers) {
    if (a.matchday !== matchday) continue;
    const option = findPressQuestion(a.questionId)?.options.find((o) => o.id === a.optionId);
    if (option) delta += option.effect.morale;
  }
  return delta;
}

/**
 * Record a press answer and apply it to the LIVE career.
 *
 * The morale bump lands on the in-progress season's human players immediately, so
 * it only ever affects matchdays not yet played (past results are fixed). The
 * decision is stamped with the current matchday and appended to the log, ready to
 * be reproduced on load. Answering the same matchday twice, or an unknown
 * question/option, is a no-op.
 */
export function answerPressConference(
  career: CareerState,
  questionId: string,
  optionId: string,
): CareerState {
  const matchday = career.season.currentMatchday;
  const answers = pressAnswers(career);
  if (answers.some((a) => a.matchday === matchday)) return career;
  const option = findPressQuestion(questionId)?.options.find((o) => o.id === optionId);
  if (!option) return career;
  const answer: PressAnswer = { matchday, questionId, optionId };
  const season = bumpSeasonMorale(career.season, career.humanTeamId, option.effect.morale);
  return { ...career, press: { answers: [...answers, answer] }, season };
}

/**
 * Replay a fresh season up to (but not playing) `targetMatchday`, interleaving the
 * press morale bumps at the exact matchday each was taken at — so a loaded career
 * reconstructs the live one that produced these answers, results included. With no
 * answers this is identical to a plain matchday replay.
 */
export function replaySeasonWithPress(
  fresh: SeasonState,
  targetMatchday: number,
  humanTeamId: string,
  answers: readonly PressAnswer[],
): SeasonState {
  let s = fresh;
  while (s.currentMatchday < targetMatchday && !isSeasonOver(s)) {
    s = bumpSeasonMorale(s, humanTeamId, moraleDeltaAt(answers, s.currentMatchday));
    s = advanceMatchday(s).state;
  }
  // Resume point: apply a bump answered before this not-yet-played matchday, so
  // the loaded squad's morale matches the live one about to play it.
  return bumpSeasonMorale(s, humanTeamId, moraleDeltaAt(answers, s.currentMatchday));
}
