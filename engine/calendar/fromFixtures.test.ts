import { describe, it, expect } from 'vitest';
import { buildCalendarFromFixtures, type RealMatchInput } from './fromFixtures';

const sample: RealMatchInput[] = [
  { round: 1, homeId: 'depor', awayId: 'madrid', date: '1996-08-31', homeGoals: 1, awayGoals: 1 },
  { round: 1, homeId: 'atleti', awayId: 'celta', date: '1996-09-01', homeGoals: 2, awayGoals: 0 },
  { round: 2, homeId: 'madrid', awayId: 'atleti', date: '1996-09-08', homeGoals: 4, awayGoals: 0 },
];

describe('buildCalendarFromFixtures', () => {
  it('preserves pairings, rounds and input order', () => {
    const fixtures = buildCalendarFromFixtures(sample);
    expect(fixtures).toHaveLength(3);
    expect(fixtures.map((f) => [f.round, f.homeId, f.awayId])).toEqual([
      [1, 'depor', 'madrid'],
      [1, 'atleti', 'celta'],
      [2, 'madrid', 'atleti'],
    ]);
  });

  it('carries the real date and historical score', () => {
    const [first] = buildCalendarFromFixtures(sample);
    expect(first?.date).toBe('1996-08-31');
    expect(first?.historicalScore).toEqual({ homeGoals: 1, awayGoals: 1 });
  });

  it('omits date and score when the input has none', () => {
    const [f] = buildCalendarFromFixtures([{ round: 1, homeId: 'a', awayId: 'b' }]);
    expect(f?.date).toBeUndefined();
    expect(f?.historicalScore).toBeUndefined();
  });

  it('requires both goals together (no partial score)', () => {
    const [f] = buildCalendarFromFixtures([{ round: 1, homeId: 'a', awayId: 'b', homeGoals: 2 }]);
    expect(f?.historicalScore).toBeUndefined();
  });

  it('is deterministic for the same input', () => {
    expect(buildCalendarFromFixtures(sample)).toEqual(buildCalendarFromFixtures(sample));
  });

  it('throws on an empty fixture list', () => {
    expect(() => buildCalendarFromFixtures([])).toThrow();
  });
});
