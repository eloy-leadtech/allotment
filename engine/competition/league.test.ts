import { describe, it, expect } from 'vitest';
import { runLeagueSeason, buildCalendar } from './league';
import type { CompetitionTeam } from './types';
import type { Line, MatchPlayer } from '../match';

function makeCompTeam(id: string, level: number): CompetitionTeam {
  const players: MatchPlayer[] = [
    { id: `${id}-gk`, nombre: `${id} GK`, posicion: 'POR', esPortero: true, media: 75, remate: 10, ofensivo: 10, pase: 20, entrada: 20, porteria: 78 },
  ];
  const lines: Line[] = ['DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'DEF', 'MED', 'DEL', 'MED'];
  lines.forEach((posicion, i) => {
    players.push({ id: `${id}-${i}`, nombre: `${id} ${i}`, posicion, esPortero: false, media: level, remate: level, ofensivo: level, pase: level, entrada: level, porteria: 10 });
  });
  return { id, nombre: id, players };
}

const teams: CompetitionTeam[] = [
  makeCompTeam('a', 80),
  makeCompTeam('b', 70),
  makeCompTeam('c', 60),
  makeCompTeam('d', 50),
];
const config = { relegationSpots: 1, pointsForWin: 3 as const, seed: 4242 };

describe('runLeagueSeason', () => {
  it('plays a full double round-robin', () => {
    const season = runLeagueSeason(teams, config);
    expect(season.fixtures).toHaveLength(4 * 3);
    expect(season.results).toHaveLength(4 * 3);
    expect(season.standings).toHaveLength(4);
  });

  it('produces a coherent table (games played and goals balance)', () => {
    const season = runLeagueSeason(teams, config);
    for (const row of season.standings) {
      expect(row.played).toBe(6); // 3 opponents home & away
      expect(row.won + row.drawn + row.lost).toBe(6);
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
    const gf = season.standings.reduce((n, r) => n + r.goalsFor, 0);
    const ga = season.standings.reduce((n, r) => n + r.goalsAgainst, 0);
    expect(gf).toBe(ga);
  });

  it('relegates the configured number of teams', () => {
    const season = runLeagueSeason(teams, config);
    expect(season.relegated).toHaveLength(1);
    const last = season.standings[season.standings.length - 1];
    expect(season.relegated[0]).toBe(last?.teamId);
  });

  it('is deterministic for the same seed', () => {
    const a = runLeagueSeason(teams, config);
    const b = runLeagueSeason(teams, config);
    expect(a.standings).toEqual(b.standings);
    expect(a.fixtures).toEqual(b.fixtures);
  });

  it('varies the calendar with the seed', () => {
    const c1 = buildCalendar(['a', 'b', 'c', 'd'], 1);
    const c2 = buildCalendar(['a', 'b', 'c', 'd'], 2);
    expect(JSON.stringify(c1)).not.toBe(JSON.stringify(c2));
  });
});
