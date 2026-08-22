import { describe, it, expect } from 'vitest';
import {
  computeSeasonObjective,
  evaluateObjective,
  EUROPEAN_SPOTS,
  PROMOTION_SPOTS,
  type BoardObjective,
} from './board';

/** A squad of 11 clones with the given media (drives the club's rating). */
function squad(id: string, media: number) {
  return { id, players: Array.from({ length: 11 }, () => ({ media })) };
}

/**
 * A field of `n` clubs, best-first by media: t1 is strongest, tn weakest. The
 * media gap keeps ranking unambiguous and deterministic.
 */
function field(n: number) {
  return Array.from({ length: n }, (_, i) => squad(`t${i + 1}`, 90 - i));
}

describe('computeSeasonObjective (Primera)', () => {
  const teams = field(20);
  const relegationSpots = 3;
  const objective = (humanTeamId: string): BoardObjective =>
    computeSeasonObjective({ teams, division: 'primera', humanTeamId, relegationSpots });

  it('asks the strongest squad to win the league', () => {
    expect(objective('t1')).toEqual({ type: 'title', targetPosition: 1 });
  });

  it('asks a top-four squad to reach Europe', () => {
    expect(objective('t3')).toEqual({ type: 'europe', targetPosition: EUROPEAN_SPOTS });
  });

  it('asks a mid-table squad for a safe finish', () => {
    const obj = objective('t10');
    expect(obj.type).toBe('mid-table');
    expect(obj.targetPosition).toBe(20 - relegationSpots);
  });

  it('asks the weakest squads only to survive', () => {
    const obj = objective('t20');
    expect(obj.type).toBe('avoid-relegation');
    expect(obj.targetPosition).toBe(20 - relegationSpots);
  });
});

describe('computeSeasonObjective (Segunda)', () => {
  const teams = field(22);
  it('asks a strong Segunda squad to go up', () => {
    expect(
      computeSeasonObjective({ teams, division: 'segunda', humanTeamId: 't2', relegationSpots: 4 }),
    ).toEqual({ type: 'promotion', targetPosition: PROMOTION_SPOTS });
  });
  it('asks a weak Segunda squad to survive', () => {
    const obj = computeSeasonObjective({
      teams,
      division: 'segunda',
      humanTeamId: 't22',
      relegationSpots: 4,
    });
    expect(obj.type).toBe('avoid-relegation');
  });
});

describe('evaluateObjective', () => {
  const objective: BoardObjective = { type: 'europe', targetPosition: 4 };

  it('is happy when the target is beaten or met', () => {
    expect(evaluateObjective(objective, 2, 'stays').satisfaction).toBe('contento');
    expect(evaluateObjective(objective, 4, 'stays').satisfaction).toBe('contento');
  });

  it('tolerates a narrow miss', () => {
    expect(evaluateObjective(objective, 6, 'stays').satisfaction).toBe('normal');
  });

  it('is angry on a clear miss', () => {
    expect(evaluateObjective(objective, 10, 'stays').satisfaction).toBe('enfadado');
  });

  it('always sacks the manager on relegation', () => {
    const verdict = evaluateObjective({ type: 'avoid-relegation', targetPosition: 17 }, 19, 'relegated');
    expect(verdict.satisfaction).toBe('enfadado');
    expect(verdict.dismissed).toBe(true);
  });

  it('does NOT sack on a catastrophic shortfall without relegation (aviso, not cese)', () => {
    // Faithful to the classic game: a single missed objective — however large the
    // shortfall — angers the board but never ends the tenure on its own. Only
    // relegation is a hard verdict; sustained failure sinks the confianza meter.
    const verdict = evaluateObjective(objective, objective.targetPosition + 12, 'stays');
    expect(verdict.satisfaction).toBe('enfadado');
    expect(verdict.dismissed).toBe(false);
  });

  it('does not sack for a merely disappointing season', () => {
    expect(evaluateObjective(objective, 8, 'stays').dismissed).toBe(false);
  });

  it('reports the shortfall (positive means below target)', () => {
    expect(evaluateObjective(objective, 7, 'stays').shortfall).toBe(3);
    expect(evaluateObjective(objective, 2, 'stays').shortfall).toBe(-2);
  });
});
