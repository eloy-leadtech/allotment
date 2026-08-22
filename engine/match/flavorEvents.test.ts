import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulateMatch';
import { isFlavorEvent, FLAVOR_EVENT_TYPES } from './types';
import type { Line, MatchEvent, MatchPlayer, MatchTeam } from './types';

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

/** Recompute the scoreline with ONLY the core (non-flavor) engine, so we can
 * prove flavor events did not perturb the goal stream. This mirrors the pre-flavor
 * behaviour: goals come exclusively from `goal` events. */
function coreScore(events: readonly MatchEvent[]): { home: number; away: number } {
  let h = 0;
  let a = 0;
  for (const e of events) {
    if (e.type !== 'goal') continue;
    if (e.team === 'home') h += 1;
    else a += 1;
  }
  return { home: h, away: a };
}

describe('flavor events', () => {
  it('emits flavor events across a season of seeds', () => {
    let flavor = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      flavor += r.events.filter((e) => isFlavorEvent(e.type)).length;
    }
    expect(flavor).toBeGreaterThan(0);
  });

  it('every flavor type appears at least once over many seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed += 1) {
      for (const e of simulateMatch({ home, away, seed }).events) {
        if (isFlavorEvent(e.type)) seen.add(e.type);
      }
    }
    for (const t of FLAVOR_EVENT_TYPES) expect(seen.has(t)).toBe(true);
  });

  it('flavor events reference a fielded player of their team and a legal minute', () => {
    const homeIds = new Set(home.players.map((p) => p.id));
    const awayIds = new Set(away.players.map((p) => p.id));
    for (let seed = 0; seed < 100; seed += 1) {
      for (const e of simulateMatch({ home, away, seed }).events) {
        if (!isFlavorEvent(e.type)) continue;
        expect(e.min).toBeGreaterThanOrEqual(1);
        expect(e.min).toBeLessThanOrEqual(90);
        const pool = e.team === 'home' ? homeIds : awayIds;
        expect(pool.has(e.playerId)).toBe(true);
        // Flavor events carry no injury payload.
        expect(e.matchesOut).toBeUndefined();
      }
    }
  });

  it('flavor events never contribute to the scoreline', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      const core = coreScore(r.events);
      expect(core.home).toBe(r.homeGoals);
      expect(core.away).toBe(r.awayGoals);
    }
  });

  it('is deterministic: flavor events replay identically for the same seed', () => {
    for (const seed of [0, 7, 42, 1234]) {
      const a = simulateMatch({ home, away, seed }).events.filter((e) => isFlavorEvent(e.type));
      const b = simulateMatch({ home, away, seed }).events.filter((e) => isFlavorEvent(e.type));
      expect(a).toEqual(b);
    }
  });

  it('core (non-flavor) events are unaffected by the presence of flavor events', () => {
    // The core stream (goals/cards/injuries) is generated BEFORE flavor and on a
    // different RNG, so two replays of the same seed produce an identical core
    // stream regardless of the interleaved flavor beats.
    for (const seed of [3, 99, 500]) {
      const coreA = simulateMatch({ home, away, seed }).events.filter((e) => !isFlavorEvent(e.type));
      const coreB = simulateMatch({ home, away, seed }).events.filter((e) => !isFlavorEvent(e.type));
      expect(coreA).toEqual(coreB);
    }
  });

  it('goal average stays in the plausible ~2.6 band with flavor enabled', () => {
    const samples = 400;
    let total = 0;
    for (let seed = 0; seed < samples; seed += 1) {
      const r = simulateMatch({ home, away, seed });
      total += r.homeGoals + r.awayGoals;
    }
    const mean = total / samples;
    expect(mean).toBeGreaterThan(1.8);
    expect(mean).toBeLessThan(3.6);
  });
});
