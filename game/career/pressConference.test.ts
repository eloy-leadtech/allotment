import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { MatchResult } from '@engine';
import { advanceMatchday } from '../season/season';
import { serializeCareer, restoreCareer } from '../save/save';
import { newCareer } from './career';
import {
  selectPressQuestion,
  answerPressConference,
  currentSituation,
  pressStanding,
  pressBoardSatisfaction,
  replaySeasonWithPress,
  findPressQuestion,
  PRESS_QUESTIONS,
} from './pressConference';
import type { CareerState } from './types';

const league = loadPrimera9697();
const humanId = league.equipos[0]?.id ?? '';
const oppId = league.equipos[1]?.id ?? '';
const base = newCareer(league, humanId, 777);

/** A human home match with the given scoreline. */
function match(gf: number, ga: number): MatchResult {
  return { homeId: humanId, awayId: oppId, homeGoals: gf, awayGoals: ga, events: [] };
}

/** The base career with the human's results swapped for a crafted sequence. */
function withResults(results: MatchResult[]): CareerState {
  return { ...base, season: { ...base.season, results } };
}

/** Human squad morales in the in-progress season, keyed by player id. */
function morales(career: CareerState): string[] {
  return (career.season.teams.find((t) => t.id === humanId)?.players ?? [])
    .map((p) => `${p.id}:${p.morale}`)
    .sort();
}

describe('currentSituation', () => {
  it('is season-start before any match is played', () => {
    expect(currentSituation(base)).toBe('season-start');
  });

  it('detects a winning run of three', () => {
    expect(currentSituation(withResults([match(1, 0), match(2, 1), match(1, 0)]))).toBe('good-run');
  });

  it('detects a losing run of three', () => {
    expect(currentSituation(withResults([match(0, 1), match(1, 2), match(0, 1)]))).toBe('bad-run');
  });

  it('flags a heavy defeat as a big loss', () => {
    expect(currentSituation(withResults([match(1, 0), match(0, 4)]))).toBe('big-loss');
  });

  it('flags a thrashing as a big win', () => {
    expect(currentSituation(withResults([match(0, 1), match(4, 0)]))).toBe('big-win');
  });

  it('falls back to routine for an ordinary result', () => {
    expect(currentSituation(withResults([match(1, 1)]))).toBe('routine');
  });
});

describe('selectPressQuestion', () => {
  it('offers a season-start question deterministically at kick-off', () => {
    const a = selectPressQuestion(base);
    const b = selectPressQuestion(base);
    expect(a).not.toBeNull();
    expect(a?.question.situation).toBe('season-start');
    expect(a).toEqual(b);
  });

  it('matches the situation of the moment', () => {
    const badRun = withResults([match(0, 1), match(1, 2), match(0, 1)]);
    expect(selectPressQuestion(badRun)?.question.situation).toBe('bad-run');
  });

  it('returns null once this matchday has been answered', () => {
    const q = selectPressQuestion(base);
    const answered = answerPressConference(base, q!.question.id, q!.question.options[0]!.id);
    expect(selectPressQuestion(answered)).toBeNull();
  });

  it('every question in the bank has 2-3 answers', () => {
    for (const q of PRESS_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('answerPressConference', () => {
  it('records the decision and bumps every human player’s morale', () => {
    const q = selectPressQuestion(base)!;
    // The first season-start option is a confident +3 morale answer.
    const option = q.question.options[0]!;
    expect(option.effect.morale).toBeGreaterThan(0);
    const after = answerPressConference(base, q.question.id, option.id);
    expect(after.press?.answers).toEqual([
      { matchday: 1, questionId: q.question.id, optionId: option.id },
    ]);
    const players = after.season.teams.find((t) => t.id === humanId)?.players ?? [];
    expect(players.length).toBeGreaterThan(0);
    expect(players.every((p) => (p.morale ?? 50) === 50 + option.effect.morale)).toBe(true);
  });

  it('is a no-op when the same matchday is answered twice', () => {
    const q = selectPressQuestion(base)!;
    const once = answerPressConference(base, q.question.id, q.question.options[0]!.id);
    const twice = answerPressConference(once, q.question.id, q.question.options[1]!.id);
    expect(twice).toBe(once);
  });

  it('ignores an unknown question or option', () => {
    expect(answerPressConference(base, 'nope', 'nope')).toBe(base);
    const q = selectPressQuestion(base)!;
    expect(answerPressConference(base, q.question.id, 'not-an-option')).toBe(base);
  });

  it('only bumps the human squad, never the rivals', () => {
    const q = selectPressQuestion(base)!;
    const after = answerPressConference(base, q.question.id, q.question.options[0]!.id);
    const rival = after.season.teams.find((t) => t.id === oppId)?.players ?? [];
    expect(rival.every((p) => (p.morale ?? 50) === 50)).toBe(true);
  });
});

describe('pressStanding / pressBoardSatisfaction', () => {
  it('accumulates morale and board deltas across answers', () => {
    const q = findPressQuestion('q-start-objetivo')!;
    const ambicioso = q.options.find((o) => o.id === 'ambicioso')!;
    const answered = answerPressConference(base, q.id, ambicioso.id);
    expect(pressStanding(answered)).toEqual({ morale: ambicioso.effect.morale, board: ambicioso.effect.board });
  });

  it('maps a positive board standing to a happy board', () => {
    const q = findPressQuestion('q-start-objetivo')!;
    const answered = answerPressConference(base, q.id, 'ambicioso'); // board +2
    expect(pressBoardSatisfaction(answered)).toBe('contento');
  });

  it('is neutral with no declarations', () => {
    expect(pressStanding(base)).toEqual({ morale: 0, board: 0 });
    expect(pressBoardSatisfaction(base)).toBe('normal');
  });
});

describe('replaySeasonWithPress', () => {
  it('with no answers is identical to a plain replay', () => {
    let plain = base.season;
    for (let i = 0; i < 5; i += 1) plain = advanceMatchday(plain).state;
    const replayed = replaySeasonWithPress(base.season, 6, humanId, []);
    expect(replayed.results).toEqual(plain.results);
    expect(morales({ ...base, season: replayed })).toEqual(morales({ ...base, season: plain }));
  });
});

describe('press decisions survive save/load exactly', () => {
  it('reproduces results and morale of a career shaped by press answers', () => {
    // Live flow: answer, play, play, answer, play — exactly what the store does.
    let career = base;
    const q1 = selectPressQuestion(career)!;
    career = answerPressConference(career, q1.question.id, q1.question.options[0]!.id);
    career = { ...career, season: advanceMatchday(career.season).state }; // md 1
    career = { ...career, season: advanceMatchday(career.season).state }; // md 2
    const q3 = selectPressQuestion(career)!;
    career = answerPressConference(career, q3.question.id, q3.question.options[1]!.id);
    career = { ...career, season: advanceMatchday(career.season).state }; // md 3

    expect(career.press?.answers).toHaveLength(2);
    // The mechanic is live: the vestuario is off neutral.
    expect(morales(career).some((m) => !m.endsWith(':50'))).toBe(true);

    const restored = restoreCareer(serializeCareer(career), league);
    expect(restored.press).toEqual(career.press);
    // Results and morale reconstruct identically (bumps interleaved into the replay).
    expect(restored.season.results).toEqual(career.season.results);
    expect(morales(restored)).toEqual(morales(career));
    expect(restored.season.currentMatchday).toBe(career.season.currentMatchday);
  });
});
