import { describe, it, expect } from 'vitest';
import {
  NEUTRAL_FORM,
  NEUTRAL_MORALE,
  clampScore,
  performanceMultiplier,
  outcomeOf,
  nextForm,
  nextMorale,
  updateTeamFormMorale,
  scoreTier,
  squadMorale,
  type PlayerMatchContext,
} from './morale';
import { computeStrength } from './strength';
import type { MatchPlayer } from './types';

const played = (outcome: 'win' | 'draw' | 'loss', goalsScored = 0): PlayerMatchContext => ({
  played: true,
  outcome,
  goalsScored,
});

function outfielder(id: string, form?: number, morale?: number): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: 'DEL',
    esPortero: false,
    media: 70,
    remate: 70,
    ofensivo: 70,
    pase: 70,
    entrada: 70,
    porteria: 10,
    form,
    morale,
  };
}

describe('performanceMultiplier', () => {
  it('is exactly 1 at neutral (and for unset form/morale)', () => {
    expect(performanceMultiplier(NEUTRAL_FORM, NEUTRAL_MORALE)).toBe(1);
    expect(performanceMultiplier()).toBe(1);
  });

  it('boosts above neutral and drops below, within a small band', () => {
    expect(performanceMultiplier(100, 100)).toBeGreaterThan(1);
    expect(performanceMultiplier(100, 100)).toBeLessThanOrEqual(1.1);
    expect(performanceMultiplier(0, 0)).toBeLessThan(1);
    expect(performanceMultiplier(0, 0)).toBeGreaterThanOrEqual(0.89);
  });
});

describe('clampScore', () => {
  it('clamps to [0,100] and rounds', () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(49.6)).toBe(50);
  });
});

describe('outcomeOf', () => {
  it('maps goals to win/draw/loss', () => {
    expect(outcomeOf(2, 1)).toBe('win');
    expect(outcomeOf(1, 1)).toBe('draw');
    expect(outcomeOf(0, 1)).toBe('loss');
  });
});

describe('nextForm', () => {
  it('rises on a win and falls on a loss from neutral', () => {
    expect(nextForm(NEUTRAL_FORM, played('win'))).toBeGreaterThan(NEUTRAL_FORM);
    expect(nextForm(NEUTRAL_FORM, played('loss'))).toBeLessThan(NEUTRAL_FORM);
  });

  it('rewards scoring on top of the result', () => {
    const win = nextForm(NEUTRAL_FORM, played('win', 0));
    const winScorer = nextForm(NEUTRAL_FORM, played('win', 2));
    expect(winScorer).toBeGreaterThan(win);
  });

  it('regresses a hot streak back toward neutral when idle-ish', () => {
    // A very high form drifts down toward 50 even after a draw.
    expect(nextForm(90, played('draw'))).toBeLessThan(90);
  });

  it('penalises a benched player', () => {
    expect(nextForm(NEUTRAL_FORM, { played: false, outcome: 'win', goalsScored: 0 })).toBeLessThan(
      NEUTRAL_FORM,
    );
  });

  it('stays within [0,100]', () => {
    let hot = NEUTRAL_FORM;
    for (let i = 0; i < 50; i += 1) hot = nextForm(hot, played('win', 3));
    expect(hot).toBeLessThanOrEqual(100);
    let cold = NEUTRAL_FORM;
    for (let i = 0; i < 50; i += 1) cold = nextForm(cold, played('loss'));
    expect(cold).toBeGreaterThanOrEqual(0);
  });
});

describe('nextMorale', () => {
  it('rises on a win and falls on a loss, more gently than form', () => {
    const formSwing = nextForm(NEUTRAL_FORM, played('win')) - NEUTRAL_FORM;
    const moraleSwing = nextMorale(NEUTRAL_MORALE, played('win')) - NEUTRAL_MORALE;
    expect(moraleSwing).toBeGreaterThan(0);
    expect(moraleSwing).toBeLessThan(formSwing);
    expect(nextMorale(NEUTRAL_MORALE, played('loss'))).toBeLessThan(NEUTRAL_MORALE);
  });

  it('dents a benched player more on a defeat than a win', () => {
    const benchLoss = nextMorale(NEUTRAL_MORALE, { played: false, outcome: 'loss', goalsScored: 0 });
    const benchWin = nextMorale(NEUTRAL_MORALE, { played: false, outcome: 'win', goalsScored: 0 });
    expect(benchLoss).toBeLessThan(benchWin);
  });
});

describe('scoreTier', () => {
  it('is 0 at neutral and saturates at ±3', () => {
    expect(scoreTier(50)).toBe(0);
    expect(scoreTier(100)).toBe(3);
    expect(scoreTier(0)).toBe(-3);
  });

  it('is monotonic', () => {
    expect(scoreTier(60)).toBeGreaterThanOrEqual(scoreTier(50));
    expect(scoreTier(40)).toBeLessThanOrEqual(scoreTier(50));
  });
});

describe('updateTeamFormMorale', () => {
  it('lifts a scorer who played and dents an unused sub, without mutating input', () => {
    const starter = outfielder('a');
    const sub = outfielder('b');
    const players = [starter, sub];
    const updated = updateTeamFormMorale(
      players,
      new Set(['a']),
      2,
      0,
      new Map([['a', 1]]),
    );
    const a = updated.find((p) => p.id === 'a');
    const b = updated.find((p) => p.id === 'b');
    expect(a?.form).toBeGreaterThan(NEUTRAL_FORM);
    expect(b?.form).toBeLessThan(NEUTRAL_FORM);
    // input untouched
    expect(starter.form).toBeUndefined();
    expect(sub.form).toBeUndefined();
  });
});

describe('squadMorale', () => {
  it('is the mean morale, neutral for an empty squad', () => {
    expect(squadMorale([])).toBe(NEUTRAL_MORALE);
    expect(squadMorale([outfielder('a', 50, 40), outfielder('b', 50, 60)])).toBe(50);
  });
});

describe('form/morale in computeStrength', () => {
  it('a squad in form outscores an identical neutral squad in effective strength', () => {
    const neutral = [outfielder('n1'), outfielder('n2'), outfielder('n3')];
    const hot = [
      outfielder('h1', 90, 80),
      outfielder('h2', 90, 80),
      outfielder('h3', 90, 80),
    ];
    expect(computeStrength(hot).attack).toBeGreaterThan(computeStrength(neutral).attack);
    expect(computeStrength(hot).defense).toBeGreaterThan(computeStrength(neutral).defense);
  });

  it('leaves a neutral squad identical to one with no form data', () => {
    const bare = [outfielder('x1'), outfielder('x2')];
    const neutral = [outfielder('y1', NEUTRAL_FORM, NEUTRAL_MORALE), outfielder('y2', NEUTRAL_FORM, NEUTRAL_MORALE)];
    expect(computeStrength(neutral).attack).toBe(computeStrength(bare).attack);
  });
});
