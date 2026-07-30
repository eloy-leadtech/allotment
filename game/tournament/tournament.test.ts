import { describe, it, expect } from 'vitest';
import type { CompetitionTeam, MatchPlayer } from '@engine';
import { runTournament, drawGroups } from './tournament';

function player(id: string, line: MatchPlayer['posicion'], media: number): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: line,
    esPortero: line === 'POR',
    media,
    remate: media,
    ofensivo: media,
    pase: media,
    entrada: media,
    porteria: line === 'POR' ? media : 10,
  };
}

/** A minimal 11-man team of the given strength. */
function team(id: string, media: number): CompetitionTeam {
  const players = [player(`${id}-gk`, 'POR', media)];
  for (let i = 0; i < 10; i += 1) {
    const line = i < 4 ? 'DEF' : i < 8 ? 'MED' : 'DEL';
    players.push(player(`${id}-p${i}`, line, media));
  }
  return { id, nombre: id.toUpperCase(), players };
}

const sixteen = (): CompetitionTeam[] =>
  Array.from({ length: 16 }, (_, i) => team(`t${i + 1}`, 60 + (i % 8)));

describe('drawGroups', () => {
  it('splits 16 teams into 4 groups of 4, using every team once', () => {
    const groups = drawGroups(sixteen().map((t) => t.id), 4, 2024);
    expect(groups).toHaveLength(4);
    for (const g of groups) expect(g).toHaveLength(4);
    const all = groups.flat().sort();
    expect(new Set(all).size).toBe(16);
  });

  it('is deterministic', () => {
    const ids = sixteen().map((t) => t.id);
    expect(drawGroups(ids, 4, 7)).toEqual(drawGroups(ids, 4, 7));
  });
});

describe('runTournament', () => {
  const result = runTournament(sixteen(), 2024);

  it('plays four groups where every team plays three matches', () => {
    expect(result.groups).toHaveLength(4);
    for (const g of result.groups) {
      expect(g.standings).toHaveLength(4);
      for (const row of g.standings) expect(row.played).toBe(3);
    }
  });

  it('runs cuartos, semifinales and final', () => {
    expect(result.knockout.map((r) => r.nombre)).toEqual(['cuartos', 'semifinales', 'final']);
    expect(result.knockout[0]!.ties).toHaveLength(4);
    expect(result.knockout[1]!.ties).toHaveLength(2);
    expect(result.knockout[2]!.ties).toHaveLength(1);
  });

  it('crowns a champion that actually won the final', () => {
    const finalTie = result.knockout.at(-1)!.ties[0]!;
    expect(result.championId).toBe(finalTie.winnerId);
    expect(sixteen().some((t) => t.id === result.championId)).toBe(true);
  });

  it('settles level knockout ties on penalties with a winner', () => {
    for (const round of result.knockout) {
      for (const tie of round.ties) {
        if (tie.homeGoals === tie.awayGoals) expect(tie.onPenalties).toBe(true);
        expect([tie.homeId, tie.awayId]).toContain(tie.winnerId);
      }
    }
  });

  it('is deterministic', () => {
    expect(runTournament(sixteen(), 2024)).toEqual(runTournament(sixteen(), 2024));
    // A different seed can change the champion (sensitivity, not guaranteed but typical here).
    const other = runTournament(sixteen(), 999);
    expect(other.championId).toBeDefined();
  });
});
