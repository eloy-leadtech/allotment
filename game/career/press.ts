/**
 * Press feed — a deterministic teletype of newspaper headlines about the human
 * club, generated from the league results already played. Pure: the feed is a
 * function of the season's results (plus the career seed for headline variety),
 * so it can be regenerated on load instead of being persisted.
 *
 * After each matchday the human plays, the press files one headline about the
 * result and, on a run of three or more wins or losses, a second about the
 * streak — a small "1-2 headlines per matchday" ticker, as in the classic game.
 */
import { hashSeed } from '@engine';
import type { CareerState } from './types';

/** One press headline, tied to the matchday it comments on. */
export interface Headline {
  /** 1-indexed matchday the headline reacts to. */
  matchday: number;
  text: string;
}

/** The human's view of one of their matches, in the order they were played. */
interface HumanMatch {
  matchday: number;
  result: 'win' | 'draw' | 'loss';
  goalsFor: number;
  goalsAgainst: number;
  opponent: string;
}

/** Deterministically pick one variant from `options` for a given key. */
function pick(options: readonly string[], seed: number, ...key: (number | string)[]): string {
  const index = hashSeed(seed, 'press', ...key) % options.length;
  return options[index] ?? options[0] ?? '';
}

/**
 * The human's matches, in played order, reduced to the club's own perspective.
 * Results are appended matchday by matchday and the human plays exactly once per
 * matchday, so the k-th human match is matchday k.
 */
function humanMatches(career: CareerState): HumanMatch[] {
  const humanId = career.humanTeamId;
  const name = new Map(career.season.teams.map((t) => [t.id, t.nombre]));
  const matches: HumanMatch[] = [];
  for (const r of career.season.results) {
    const isHome = r.homeId === humanId;
    const isAway = r.awayId === humanId;
    if (!isHome && !isAway) continue;
    const goalsFor = isHome ? r.homeGoals : r.awayGoals;
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals;
    const opponentId = isHome ? r.awayId : r.homeId;
    matches.push({
      matchday: matches.length + 1,
      result: goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw',
      goalsFor,
      goalsAgainst,
      opponent: name.get(opponentId) ?? opponentId,
    });
  }
  return matches;
}

/** The main headline reacting to a single result. */
function resultHeadline(seed: number, team: string, m: HumanMatch): string {
  const margin = m.goalsFor - m.goalsAgainst;
  if (m.result === 'win') {
    const options =
      margin >= 3
        ? [
            `Goleada del ${team}: ${m.goalsFor}-${m.goalsAgainst} para ilusionarse`,
            `El ${team} arrasa al ${m.opponent} y se lleva los tres puntos`,
            `Exhibicion del ${team} ante el ${m.opponent}`,
          ]
        : [
            `Victoria del ${team} frente al ${m.opponent}`,
            `Triunfo trabajado del ${team} ante el ${m.opponent}`,
            `El ${team} suma tres puntos de oro`,
          ];
    return pick(options, seed, m.matchday, 'win');
  }
  if (m.result === 'loss') {
    const options = [
      `Derrota del ${team} en su visita al ${m.opponent}`,
      `Tropiezo del ${team} frente al ${m.opponent}`,
      `El ${team} cae ante el ${m.opponent} y enciende las alarmas`,
    ];
    return pick(options, seed, m.matchday, 'loss');
  }
  const options = [
    `El ${team} reparte puntos con el ${m.opponent}`,
    `Empate sin premio del ${team} ante el ${m.opponent}`,
    `El ${team} no pasa del empate frente al ${m.opponent}`,
  ];
  return pick(options, seed, m.matchday, 'draw');
}

/** A secondary headline when the club is on a 3+ win or loss streak. */
function streakHeadline(seed: number, team: string, m: HumanMatch, streak: number): string | null {
  if (streak < 3) return null;
  if (m.result === 'win') {
    const options = [
      `El ${team} encadena ${streak} victorias seguidas`,
      `Racha imparable: el ${team} suma ${streak} triunfos consecutivos`,
    ];
    return pick(options, seed, m.matchday, 'streak-win');
  }
  if (m.result === 'loss') {
    const options = [
      `Crisis en el ${team}: ${streak} derrotas consecutivas`,
      `El ${team} se hunde con ${streak} derrotas seguidas`,
    ];
    return pick(options, seed, m.matchday, 'streak-loss');
  }
  return null;
}

/**
 * The full press feed for the season so far, oldest first. One headline per
 * human matchday, plus a streak headline on runs of three or more wins/losses.
 */
export function pressFeed(career: CareerState): Headline[] {
  const team = career.season.teams.find((t) => t.id === career.humanTeamId)?.nombre ?? career.humanTeamId;
  const matches = humanMatches(career);
  const feed: Headline[] = [];
  let winStreak = 0;
  let lossStreak = 0;
  for (const m of matches) {
    winStreak = m.result === 'win' ? winStreak + 1 : 0;
    lossStreak = m.result === 'loss' ? lossStreak + 1 : 0;
    feed.push({ matchday: m.matchday, text: resultHeadline(career.seed, team, m) });
    const streak = m.result === 'win' ? winStreak : lossStreak;
    const extra = streakHeadline(career.seed, team, m, streak);
    if (extra) feed.push({ matchday: m.matchday, text: extra });
  }
  return feed;
}

/**
 * The most recent headlines, newest first, capped to `limit` (for the ticker).
 */
export function latestHeadlines(career: CareerState, limit = 6): Headline[] {
  return pressFeed(career).slice(-limit).reverse();
}
