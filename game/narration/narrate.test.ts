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
