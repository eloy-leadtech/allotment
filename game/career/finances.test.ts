import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadSegunda9697 } from '@data';
import { newCareer } from './career';
import { seasonIncome } from './finances';
import { advanceMatchday, currentStandings } from '../season/season';
import type { CareerState } from './types';

/** Play a career's season to the end so standings/position are final. */
function playToEnd(career: CareerState): CareerState {
  let season = career.season;
  while (season.currentMatchday <= season.totalMatchdays) season = advanceMatchday(season).state;
  return { ...career, season };
}

describe('seasonIncome', () => {
  it('adds up TV, gate and a position-scaled league prize (Primera)', () => {
    const career = playToEnd(newCareer(loadPrimera9697(), 'barcelona', 7));
    const income = seasonIncome(career);
    expect(income.tv).toBe(20_000_000);
    expect(income.gate).toBe(12_000_000);
    // League prize follows the formula: (N - position + 1) * 1.2M in Primera.
    const table = currentStandings(career.season);
    const position = table.findIndex((r) => r.teamId === 'barcelona') + 1;
    expect(income.leaguePrize).toBe((table.length - position + 1) * 1_200_000);
    expect(income.total).toBe(
      income.tv + income.gate + income.leaguePrize + income.copa + income.europa + income.sponsor,
    );
    // The basic sponsor (default) still pays a positive guaranteed cheque.
    expect(income.sponsor).toBeGreaterThan(0);
  });

  it('pays a Segunda club the lower TV/gate tiers', () => {
    const seg = playToEnd({ ...newCareer(loadSegunda9697(), 'leganes', 3), division: 'segunda' });
    const income = seasonIncome(seg);
    expect(income.tv).toBe(5_000_000);
    expect(income.gate).toBe(3_000_000);
    expect(income.total).toBeLessThan(seasonIncome(playToEnd(newCareer(loadPrimera9697(), 'barcelona', 3))).total);
  });

  it('rewards a higher league finish (champion earns more prize than the bottom club)', () => {
    // Same season/seed => identical table regardless of who is human.
    const played = playToEnd(newCareer(loadPrimera9697(), 'barcelona', 5));
    const table = currentStandings(played.season);
    const championId = table[0]!.teamId;
    const lastId = table[table.length - 1]!.teamId;
    const champIncome = seasonIncome({ ...played, humanTeamId: championId });
    const lastIncome = seasonIncome({ ...played, humanTeamId: lastId });
    expect(champIncome.leaguePrize).toBeGreaterThan(lastIncome.leaguePrize);
  });

  it('is deterministic', () => {
    const c = playToEnd(newCareer(loadPrimera9697(), 'barcelona', 9));
    expect(seasonIncome(c)).toEqual(seasonIncome(c));
  });
});
