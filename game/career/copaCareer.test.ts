import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadSegunda9697 } from '@data';
import { toCompetitionTeam } from '../season/season';
import { newCareer } from './career';
import { runCareerCopa } from './competitions';

const league = loadPrimera9697();
const segunda = loadSegunda9697();
const HUMAN = 'barcelona';

/** The full domestic field: the human's evolved Primera plus the real Segunda. */
function domesticField(career: ReturnType<typeof newCareer>) {
  return [...career.season.teams, ...segunda.equipos.map(toCompetitionTeam)];
}

describe('runCareerCopa', () => {
  const career = newCareer(league, HUMAN, 2024);

  it('runs a Copa over the whole domestic field (Primera + Segunda)', () => {
    const copa = runCareerCopa(career.seed, career.seasonNumber, domesticField(career));
    const fieldSize = career.season.teams.length + segunda.equipos.length;
    expect(fieldSize).toBeGreaterThan(30);
    expect(copa.championId).not.toBe('');
    // The champion is one of the competing clubs.
    const ids = new Set(domesticField(career).map((t) => t.id));
    expect(ids.has(copa.championId)).toBe(true);
    // Ends in a final.
    expect(copa.knockout.at(-1)?.nombre).toBe('final');
  });

  it('is deterministic for the same career/season', () => {
    const a = runCareerCopa(career.seed, career.seasonNumber, domesticField(career));
    const b = runCareerCopa(career.seed, career.seasonNumber, domesticField(career));
    expect(a).toEqual(b);
  });

  it('changes with the season number', () => {
    const s1 = runCareerCopa(career.seed, 1, domesticField(career));
    const s2 = runCareerCopa(career.seed, 2, domesticField(career));
    expect(s1.championId === s2.championId && JSON.stringify(s1) === JSON.stringify(s2)).toBe(false);
  });

  it("exposes the human's cup run without changing the bracket", () => {
    const field = domesticField(career);
    const plain = runCareerCopa(career.seed, career.seasonNumber, field);
    const withHuman = runCareerCopa(career.seed, career.seasonNumber, field, HUMAN);
    // The bracket and champion are byte-identical: only the view field is added.
    expect(withHuman.knockout).toEqual(plain.knockout);
    expect(withHuman.championId).toBe(plain.championId);
    // The human plays at least one tie, each with a full match for the teletipo.
    expect(withHuman.humanPath && withHuman.humanPath.length).toBeGreaterThan(0);
    for (const step of withHuman.humanPath!) {
      expect([step.match.homeId, step.match.awayId]).toContain(HUMAN);
      expect(step.match.events.length).toBeGreaterThanOrEqual(0);
    }
  });
});
