import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer, setCareerTactics, tacticsForSquad } from './career';
import { serializeCareer, restoreCareer } from '../save/save';
import { advanceMatchday, isSeasonOver, currentStandings } from '../season/season';

const league = loadPrimera9697();
const HUMAN = 'barcelona';

function playAll(season: ReturnType<typeof newCareer>['season']): typeof season {
  let s = season;
  while (!isSeasonOver(s)) s = advanceMatchday(s).state;
  return s;
}

const goalsFor = (season: ReturnType<typeof playAll>, teamId: string): number =>
  currentStandings(season).find((r) => r.teamId === teamId)?.goalsFor ?? 0;

describe('setCareerTactics', () => {
  it('attaches the tactics to the human competition team', () => {
    const career = setCareerTactics(newCareer(league, HUMAN, 7), { formation: '4-3-3' });
    expect(career.tactics?.formation).toBe('4-3-3');
    const barca = career.season.teams.find((t) => t.id === HUMAN);
    expect(barca?.tactics?.formation).toBe('4-3-3');
    // Rivals stay neutral.
    const other = career.season.teams.find((t) => t.id !== HUMAN);
    expect(other?.tactics).toBeUndefined();
  });

  it('does not reset matches already played', () => {
    const base = newCareer(league, HUMAN, 7);
    const played = { ...base, season: advanceMatchday(base.season).state };
    const after = setCareerTactics(played, { formation: '3-4-3' });
    expect(after.season.currentMatchday).toBe(played.season.currentMatchday);
    expect(after.season.results).toHaveLength(played.season.results.length);
  });

  it('makes an attacking formation outscore a defensive one over a season', () => {
    const base = newCareer(league, HUMAN, 2024);
    const attacking = playAll(setCareerTactics(base, { formation: '3-4-3' }).season);
    const defensive = playAll(setCareerTactics(base, { formation: '5-4-1' }).season);
    expect(goalsFor(attacking, HUMAN)).toBeGreaterThan(goalsFor(defensive, HUMAN));
  });

  it('stays deterministic with tactics', () => {
    const base = newCareer(league, HUMAN, 2024);
    const a = playAll(setCareerTactics(base, { formation: '4-3-3' }).season);
    const b = playAll(setCareerTactics(base, { formation: '4-3-3' }).season);
    expect(currentStandings(a)).toEqual(currentStandings(b));
  });

  it('survives a save round-trip', () => {
    const career = setCareerTactics(newCareer(league, HUMAN, 7), { formation: '4-3-3' });
    const restored = restoreCareer(serializeCareer(career), league);
    expect(restored.tactics?.formation).toBe('4-3-3');
    expect(restored.season.teams.find((t) => t.id === HUMAN)?.tactics?.formation).toBe('4-3-3');
  });
});

describe('tacticsForSquad', () => {
  const players = newCareer(league, HUMAN, 1).season.teams.find((t) => t.id === HUMAN)!.players;

  it('resolves a valid 11-man XI', () => {
    const xiIds = players.slice(0, 11).map((p) => p.id);
    const t = tacticsForSquad({ formation: '4-4-2', xiIds }, players);
    expect(t?.xi).toHaveLength(11);
  });

  it('drops the XI (auto-select) when it cannot resolve 11', () => {
    const t = tacticsForSquad({ formation: '4-4-2', xiIds: ['missing'] }, players);
    expect(t?.formation).toBe('4-4-2');
    expect(t?.xi).toBeUndefined();
  });

  it('returns undefined when there are no tactics', () => {
    expect(tacticsForSquad(undefined, players)).toBeUndefined();
  });
});
