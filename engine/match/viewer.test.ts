import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulateMatch';
import { buildMatchFrames } from './viewer';
import type { Line, MatchPlayer, MatchResult, MatchTeam } from './types';

/** Build a plausible 15-outfield + GK squad (mirrors simulateMatch.test). */
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

// Weak keepers (55) => plenty of goals, so goal frames are well exercised.
const home = makeTeam('home', 70, 55);
const away = makeTeam('away', 70, 55);

const play = (seed: number): MatchResult => simulateMatch({ home, away, seed });

describe('buildMatchFrames — positioned beats for the 2D viewer', () => {
  it('is deterministic: the same seed yields the exact same frame sequence', () => {
    const a = buildMatchFrames(play(1234));
    const b = buildMatchFrames(play(1234));
    expect(a).toEqual(b);
  });

  it('is a pure function of the result (same result in -> same frames out)', () => {
    const result = play(99);
    expect(buildMatchFrames(result)).toEqual(buildMatchFrames(result));
  });

  it('different seeds produce different ball trajectories', () => {
    const seq = (seed: number) =>
      JSON.stringify(buildMatchFrames(play(seed)).map((f) => [f.ball.x, f.ball.y]));
    expect(seq(1)).not.toBe(seq(2));
  });

  it('frames the match as kickoff + one per event + final', () => {
    const result = play(7);
    const frames = buildMatchFrames(result);
    expect(frames.length).toBe(result.events.length + 2);

    const first = frames[0]!;
    expect(first.action).toBe('kickoff');
    expect(first.ball).toEqual({ x: 0.5, y: 0.5 });
    expect(first.event).toBeNull();
    expect(first.home).toBe(0);
    expect(first.away).toBe(0);

    const last = frames[frames.length - 1]!;
    expect(last.action).toBe('final');
    expect(last.event).toBeNull();
    expect(last.home).toBe(result.homeGoals);
    expect(last.away).toBe(result.awayGoals);
  });

  it('keeps every ball position inside the normalized pitch [0,1] x [0,1]', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      for (const f of buildMatchFrames(play(seed))) {
        expect(f.ball.x).toBeGreaterThanOrEqual(0);
        expect(f.ball.x).toBeLessThanOrEqual(1);
        expect(f.ball.y).toBeGreaterThanOrEqual(0);
        expect(f.ball.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('wires each event frame to its engine event, in order', () => {
    const result = play(42);
    const frames = buildMatchFrames(result);
    // Strip the kickoff (first) and final (last); the middle maps 1:1 to events.
    const middle = frames.slice(1, -1);
    expect(middle.length).toBe(result.events.length);
    middle.forEach((f, i) => {
      expect(f.event).toBe(result.events[i]);
      expect(f.min).toBe(result.events[i]!.min);
    });
  });

  it('runs the scoreboard monotonically to the final score', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const result = play(seed);
      const frames = buildMatchFrames(result);
      let prevH = 0;
      let prevA = 0;
      for (const f of frames) {
        expect(f.home).toBeGreaterThanOrEqual(prevH);
        expect(f.away).toBeGreaterThanOrEqual(prevA);
        prevH = f.home;
        prevA = f.away;
      }
      const last = frames[frames.length - 1]!;
      expect(last.home).toBe(result.homeGoals);
      expect(last.away).toBe(result.awayGoals);
    }
  });

  it('attacks toward the right goal: home goals land in the away half, and vice versa', () => {
    let homeGoals = 0;
    let awayGoals = 0;
    for (let seed = 0; seed < 80; seed += 1) {
      for (const f of buildMatchFrames(play(seed))) {
        if (f.action !== 'goal' || !f.event) continue;
        if (f.event.team === 'home') {
          homeGoals += 1;
          expect(f.ball.x).toBeGreaterThan(0.5);
          expect(f.possession).toBe('home');
        } else {
          awayGoals += 1;
          expect(f.ball.x).toBeLessThan(0.5);
          expect(f.possession).toBe('away');
        }
      }
    }
    // Sanity: the sample actually exercised goals on both sides.
    expect(homeGoals).toBeGreaterThan(0);
    expect(awayGoals).toBeGreaterThan(0);
  });
});
