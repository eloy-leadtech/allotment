import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer, seasonFromCareer, careerTeamName } from './career';
import { newSeason, advanceMatchday, currentStandings, isSeasonOver } from '../season/season';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

describe('career', () => {
  it('starts a career with full teams and a derived season 1', () => {
    const career = newCareer(league, humanTeamId, 2024);
    expect(career.seasonNumber).toBe(1);
    expect(career.teams).toHaveLength(22);
    expect(career.history).toHaveLength(0);
    expect(career.humanTeamId).toBe(humanTeamId);
    // The career keeps FULL player data (atributos), not the reduced match view.
    const firstPlayer = career.teams[0]?.players[0];
    expect(firstPlayer?.atributos).toBeDefined();
    // The derived season is a normal 22-team, 42-matchday season.
    expect(career.season.teams).toHaveLength(22);
    expect(career.season.totalMatchdays).toBe(42);
    expect(career.season.humanTeamId).toBe(humanTeamId);
  });

  it('rejects a human team that is not in the league', () => {
    expect(() => newCareer(league, 'no-such-team', 1)).toThrow();
  });

  it('derives a deterministic season from the same career meta', () => {
    const a = newCareer(league, humanTeamId, 99);
    const b = newCareer(league, humanTeamId, 99);
    expect(a.season.seed).toBe(b.season.seed);
    expect(a.season.fixtures).toEqual(b.season.fixtures);
  });

  it('uses a season seed distinct from the master seed', () => {
    const career = newCareer(league, humanTeamId, 2024);
    // seasonFromCareer derives its own seed via hashSeed, so it should not equal 2024.
    expect(career.season.seed).not.toBe(2024);
    // seasonNumber influences the derived seed.
    const s2 = seasonFromCareer({ ...career, seasonNumber: 2 });
    expect(s2.seed).not.toBe(career.season.seed);
  });

  it('plays the derived season to completion like a standalone season', () => {
    const career = newCareer(league, humanTeamId, 7);
    let state = career.season;
    while (!isSeasonOver(state)) {
      state = advanceMatchday(state).state;
    }
    expect(state.results).toHaveLength(462);
    expect(currentStandings(state)).toHaveLength(22);
  });

  it('newSeason still behaves as before the refactor (season 0 intact)', () => {
    const direct = newSeason(league, humanTeamId, 2024);
    expect(direct.teams).toHaveLength(22);
    expect(direct.totalMatchdays).toBe(42);
    expect(direct.currentMatchday).toBe(1);
  });

  it('resolves team names', () => {
    const career = newCareer(league, humanTeamId, 1);
    expect(careerTeamName(career, humanTeamId)).toBe(firstTeam.nombre);
    expect(careerTeamName(career, 'unknown')).toBe('unknown');
  });
});
