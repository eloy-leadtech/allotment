import { describe, it, expect } from 'vitest';
import { narrateEvent, narrateMatch } from './narrate';
import { FLAVOR_EVENT_TYPES } from '@engine';
import type { EventType, MatchEvent, MatchResult } from '@engine';

function ev(type: EventType, over: Partial<MatchEvent> = {}): MatchEvent {
  return { min: 23, type, team: 'home', playerId: 'h-1', playerName: 'Perez', ...over };
}

describe('narrateEvent', () => {
  it('narrates every flavor event with the minute, the player and the team', () => {
    for (const type of FLAVOR_EVENT_TYPES) {
      const line = narrateEvent(ev(type), 'Depor', 'Celta');
      expect(line.startsWith("23'")).toBe(true);
      expect(line).toContain('Perez');
      expect(line).toContain('Depor');
      expect(line.length).toBeGreaterThan(10);
    }
  });

  it('uses the away team name for away events', () => {
    const line = narrateEvent(ev('corner', { team: 'away', playerName: 'Rivas' }), 'Depor', 'Celta');
    expect(line).toContain('Celta');
    expect(line).toContain('Rivas');
  });

  it('is a pure deterministic function of the event (same event -> same text)', () => {
    const e = ev('saved');
    expect(narrateEvent(e, 'A', 'B')).toBe(narrateEvent(e, 'A', 'B'));
  });

  it('offers phrasing variety across different events of the same type', () => {
    const texts = new Set<string>();
    for (let min = 1; min <= 40; min += 1) {
      texts.add(narrateEvent(ev('saved', { min, playerId: `p-${min}` }), 'A', 'B'));
    }
    // More than one distinct phrasing template is used.
    const templates = new Set(
      [...texts].map((t) => t.replace(/^\d+'\s*/, '').replace(/p-\d+/g, '')),
    );
    expect(templates.size).toBeGreaterThan(1);
  });
});

describe('narrateEvent in a derby', () => {
  it('uses a tenser phrasing for a derby goal', () => {
    const plain = narrateEvent(ev('goal', { playerName: 'Raul' }), 'Depor', 'Celta', false);
    const tense = narrateEvent(ev('goal', { playerName: 'Raul' }), 'Depor', 'Celta', true);
    expect(plain).toContain('GOL de Raul');
    expect(tense).not.toBe(plain);
    expect(tense.toLowerCase()).toContain('derbi');
    expect(tense).toContain('Raul');
  });

  it('leaves non-goal events unchanged whether or not it is a derby', () => {
    const e = ev('corner');
    expect(narrateEvent(e, 'A', 'B', true)).toBe(narrateEvent(e, 'A', 'B', false));
  });
});

describe('narrateMatch derby banner', () => {
  it('opens a derby with a tension banner naming the derby', () => {
    const result: MatchResult = {
      homeId: 'real-madrid',
      awayId: 'barcelona',
      homeGoals: 1,
      awayGoals: 1,
      events: [ev('goal', { min: 20, playerName: 'Raul' })],
      derby: true,
    };
    const lines = narrateMatch(result, 'Real Madrid', 'Barcelona');
    expect(lines[0]).toContain('DERBI');
    expect(lines[0]).toContain('El Clásico');
    expect(lines[lines.length - 1]).toBe('FINAL: Real Madrid 1-1 Barcelona');
  });

  it('does NOT add a banner for a normal fixture', () => {
    const result: MatchResult = {
      homeId: 'h',
      awayId: 'a',
      homeGoals: 0,
      awayGoals: 0,
      events: [ev('corner', { min: 5 })],
    };
    const lines = narrateMatch(result, 'Depor', 'Celta');
    expect(lines.some((l) => l.includes('DERBI'))).toBe(false);
  });

  it('falls back to team ids when the derby flag is absent', () => {
    const result: MatchResult = {
      homeId: 'sevilla',
      awayId: 'betis',
      homeGoals: 0,
      awayGoals: 0,
      events: [],
    };
    const lines = narrateMatch(result, 'Sevilla', 'Betis');
    expect(lines[0]).toContain('Derbi sevillano');
  });
});

describe('narrateMatch with flavor events', () => {
  it('renders flavor lines and still closes with the final score', () => {
    const result: MatchResult = {
      homeId: 'h',
      awayId: 'a',
      homeGoals: 1,
      awayGoals: 0,
      events: [
        ev('corner', { min: 5 }),
        ev('goal', { min: 12, playerName: 'Goleador' }),
        ev('saved', { min: 30, team: 'away', playerName: 'Meta' }),
      ],
    };
    const lines = narrateMatch(result, 'Depor', 'Celta');
    expect(lines).toHaveLength(4);
    expect(lines[lines.length - 1]).toBe('FINAL: Depor 1-0 Celta');
    expect(lines.some((l) => /corner|esquina/i.test(l))).toBe(true);
  });
});
