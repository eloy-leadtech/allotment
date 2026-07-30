import { describe, it, expect } from 'vitest';
import type { CompetitionTeam, MatchPlayer } from '@engine';
import { runCopa } from './copa';
import { teamProgress } from './tournament';

function player(id: string, line: MatchPlayer['posicion'], media: number): MatchPlayer {
  return {
    id, nombre: id, posicion: line, esPortero: line === 'POR', media,
    remate: media, ofensivo: media, pase: media, entrada: media, porteria: line === 'POR' ? media : 10,
  };
}
function team(id: string, media = 65): CompetitionTeam {
  const players = [player(`${id}-gk`, 'POR', media)];
  for (let i = 0; i < 10; i += 1) players.push(player(`${id}-p${i}`, i < 4 ? 'DEF' : i < 8 ? 'MED' : 'DEL', media));
  return { id, nombre: id.toUpperCase(), players };
}
const field = (n: number): CompetitionTeam[] => Array.from({ length: n }, (_, i) => team(`t${i + 1}`, 55 + (i % 12)));

describe('runCopa', () => {
  it('runs a clean bracket for a power-of-two field', () => {
    const r = runCopa(field(8), 2024);
    expect(r.knockout.map((x) => x.nombre)).toEqual(['cuartos', 'semifinales', 'final']);
    expect(r.knockout[0]!.ties).toHaveLength(4);
    expect(r.knockout.at(-1)!.ties).toHaveLength(1);
    expect(field(8).some((t) => t.id === r.championId)).toBe(true);
    expect(r.championId).toBe(r.knockout.at(-1)!.ties[0]!.winnerId);
  });

  it('handles a non-power-of-two field with byes and still crowns a champion', () => {
    const r = runCopa(field(6), 7); // 6 -> 8-slot bracket, 2 byes
    expect(r.championId).not.toBe('');
    expect(field(6).some((t) => t.id === r.championId)).toBe(true);
    // Every played tie names a winner among its two teams.
    for (const round of r.knockout) {
      for (const tie of round.ties) expect([tie.homeId, tie.awayId]).toContain(tie.winnerId);
    }
  });

  it('is deterministic', () => {
    expect(runCopa(field(16), 99)).toEqual(runCopa(field(16), 99));
  });

  it('works with teamProgress (knockout-only)', () => {
    const r = runCopa(field(8), 2024);
    expect(teamProgress(r, r.championId)).toBe('Campeón');
    const loser = r.knockout.at(-1)!.ties[0]!;
    const runnerUp = loser.winnerId === loser.homeId ? loser.awayId : loser.homeId;
    expect(teamProgress(r, runnerUp)).toBe('Subcampeón');
  });

  it('a single team is champion with no rounds', () => {
    const r = runCopa(field(1), 1);
    expect(r.championId).toBe('t1');
    expect(r.knockout).toHaveLength(0);
  });
});
