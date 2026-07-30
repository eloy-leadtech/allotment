import { describe, it, expect } from 'vitest';
import { loadPrimera9899, loadEuropa9899 } from '@data';
import { toCompetitionTeam } from '../season/season';
import { newCareer } from './career';
import { europaQualification, runCareerEuropa } from './europa';

const league = loadPrimera9899();
const europaClubs = loadEuropa9899().equipos.map(toCompetitionTeam);
const HUMAN = 'barcelona';

describe('europaQualification', () => {
  it('sends Primera top-2 to the Champions and 3rd–6th to the UEFA', () => {
    expect(europaQualification('primera', 1)).toBe('champions');
    expect(europaQualification('primera', 2)).toBe('champions');
    expect(europaQualification('primera', 3)).toBe('uefa');
    expect(europaQualification('primera', 6)).toBe('uefa');
    expect(europaQualification('primera', 7)).toBeNull();
  });

  it('does not qualify from Segunda or without a previous season', () => {
    expect(europaQualification('segunda', 1)).toBeNull();
    expect(europaQualification(undefined, undefined)).toBeNull();
  });
});

describe('runCareerEuropa', () => {
  const career = newCareer(league, HUMAN, 2024);
  const human = career.season.teams.find((t) => t.id === HUMAN)!;

  it('runs a Champions (4 groups of 4) and a UEFA knockout', () => {
    const r = runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, {
      team: human,
      comp: null,
    });
    expect(r.champions.groups).toHaveLength(4);
    for (const g of r.champions.groups) expect(g.standings).toHaveLength(4);
    expect(r.champions.knockout.at(-1)?.nombre).toBe('final');
    expect(r.champions.championId).not.toBe('');
    expect(r.uefa.knockout.at(-1)?.nombre).toBe('final');
    expect(r.uefa.championId).not.toBe('');
    expect(r.humanComp).toBeNull();
  });

  it('injects the human into the Champions when qualified there', () => {
    const r = runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, {
      team: human,
      comp: 'champions',
    });
    const inGroups = r.champions.groups.flatMap((g) => g.standings.map((s) => s.teamId));
    expect(inGroups).toContain(HUMAN);
    // And never in the UEFA at the same time.
    const inUefa = r.uefa.knockout.flatMap((round) =>
      round.ties.flatMap((t) => [t.homeId, t.awayId]),
    );
    expect(inUefa).not.toContain(HUMAN);
    expect(r.humanComp).toBe('champions');
  });

  it('injects the human into the UEFA when qualified there', () => {
    const r = runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, {
      team: human,
      comp: 'uefa',
    });
    const inUefa = r.uefa.knockout.flatMap((round) =>
      round.ties.flatMap((t) => [t.homeId, t.awayId]),
    );
    expect(inUefa).toContain(HUMAN);
    expect(r.humanComp).toBe('uefa');
  });

  it('is deterministic for the same career/season', () => {
    const arg = { team: human, comp: 'champions' as const };
    const a = runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, arg);
    const b = runCareerEuropa(career.seed, career.seasonNumber, career.temporada, europaClubs, arg);
    expect(a).toEqual(b);
  });
});
