import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulateMatch';
import type { Line, MatchPlayer, MatchTeam } from './types';

function makeTeam(id: string, level: number, keeperRating: number): MatchTeam {
  const players: MatchPlayer[] = [
    {
      id: `${id}-gk`,
      nombre: `${id} GK`,
      posicion: 'POR',
      esPortero: true,
      media: keeperRating,
      remate: 10,
      ofensivo: 10,
      pase: 20,
      entrada: 20,
      porteria: keeperRating,
    },
  ];
  const lines: Line[] = ['DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'MED', 'DEF', 'DEL', 'MED'];
  lines.forEach((posicion, i) => {
    players.push({
      id: `${id}-${i}`,
      nombre: `${id} ${i}`,
      posicion,
      esPortero: false,
      media: level,
      remate: level,
      ofensivo: level,
      pase: level,
      entrada: level,
      porteria: 10,
    });
  });
  return { id, nombre: id, players };
}

const home = makeTeam('home', 65, 78);
const away = makeTeam('away', 65, 78);

describe('simulateMatch', () => {
  it('is deterministic for the same seed', () => {
    const a = simulateMatch({ home, away, seed: 1234 });
    const b = simulateMatch({ home, away, seed: 1234 });
    expect(a).toEqual(b);
  });

  it('produces different matches for different seeds', () => {
    const a = JSON.stringify(simulateMatch({ home, away, seed: 1 }));
    const b = JSON.stringify(simulateMatch({ home, away, seed: 2 }));
    expect(a).not.toBe(b);
  });

  it('goal events match the scoreline', () => {
    const r = simulateMatch({ home, away, seed: 77 });
    const homeGoalEvents = r.events.filter((e) => e.type === 'goal' && e.team === 'home').length;
    const awayGoalEvents = r.events.filter((e) => e.type === 'goal' && e.team === 'away').length;
    expect(homeGoalEvents).toBe(r.homeGoals);
    expect(awayGoalEvents).toBe(r.awayGoals);
  });

  it('every event references a player from the correct team', () => {
    const r = simulateMatch({ home, away, seed: 5 });
    const homeIds = new Set(home.players.map((p) => p.id));
    const awayIds = new Set(away.players.map((p) => p.id));
    for (const e of r.events) {
      const pool = e.team === 'home' ? homeIds : awayIds;
      expect(pool.has(e.playerId)).toBe(true);
    }
  });

  it('keeps every event minute within regulation time', () => {
    const r = simulateMatch({ home, away, seed: 9 });
    for (const e of r.events) {
      expect(e.min).toBeGreaterThanOrEqual(1);
      expect(e.min).toBeLessThanOrEqual(90);
    }
    // events are ordered by minute
    for (let i = 1; i < r.events.length; i += 1) {
      expect((r.events[i]?.min ?? 0) >= (r.events[i - 1]?.min ?? 0)).toBe(true);
    }
  });

  it('never sends a second yellow without a prior yellow for the same player', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      const yellows = new Set<string>();
      for (const e of r.events) {
        if (e.type === 'yellow') yellows.add(e.playerId);
        if (e.type === 'secondYellow') expect(yellows.has(e.playerId)).toBe(true);
      }
    }
  });

  it('injuries: always reference a fielded player, last 1-8 matchdays, and are deterministic', () => {
    let injuries = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      const homeIds = new Set(home.players.map((p) => p.id));
      const awayIds = new Set(away.players.map((p) => p.id));
      for (const e of r.events) {
        if (e.type !== 'injury') continue;
        injuries += 1;
        expect(e.matchesOut).toBeGreaterThanOrEqual(1);
        expect(e.matchesOut).toBeLessThanOrEqual(8);
        const pool = e.team === 'home' ? homeIds : awayIds;
        expect(pool.has(e.playerId)).toBe(true);
      }
    }
    // Over 400 matches the low per-player chance still yields some injuries.
    expect(injuries).toBeGreaterThan(0);
    // Determinism: replaying a seed reproduces the exact same injury events.
    const a = simulateMatch({ home, away, seed: 123 }).events.filter((e) => e.type === 'injury');
    const b = simulateMatch({ home, away, seed: 123 }).events.filter((e) => e.type === 'injury');
    expect(a).toEqual(b);
  });

  it('averages a plausible number of goals per game (~2.6)', () => {
    const samples = 400;
    let totalGoals = 0;
    for (let seed = 0; seed < samples; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      totalGoals += r.homeGoals + r.awayGoals;
    }
    const mean = totalGoals / samples;
    expect(mean).toBeGreaterThan(1.8);
    expect(mean).toBeLessThan(3.6);
  });
});
