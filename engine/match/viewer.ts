import { createRng, hashSeed } from '../rng';
import type { EventType, MatchEvent, MatchResult } from './types';

/**
 * Positioned beats for the 2D cenital viewer.
 *
 * This module is pure "theater of the event" (SPEC §4.4): it NEVER simulates
 * physics and NEVER changes the result. It takes the match the engine already
 * decided and lays its events out on a normalized pitch so the UI can move a
 * focus/ball around and stage each beat. Because every position is derived from
 * a deterministic RNG seeded by stable fields of the event, the same match (and
 * therefore the same seed) always produces the exact same frame sequence.
 */

/** A kind of staged beat; drives what the viewer draws at a keyframe. */
export type PlayAction =
  | 'kickoff'
  | 'goal'
  | 'chance'
  | 'save'
  | 'offTarget'
  | 'post'
  | 'corner'
  | 'foul'
  | 'yellow'
  | 'secondYellow'
  | 'red'
  | 'injury'
  | 'final';

/**
 * Normalized pitch coordinate. `x` runs along the pitch length: 0 = home's own
 * goal line, 1 = away's goal line (so the home side attacks toward x = 1). `y`
 * runs across the width: 0 = top touchline, 1 = bottom. Both are in [0, 1].
 */
export interface PitchPos {
  x: number;
  y: number;
}

/** One keyframe of the viewer timeline; the UI interpolates between consecutive frames. */
export interface MatchFrame {
  /** Minute shown for this keyframe (0 at kickoff, 90 at the final whistle). */
  min: number;
  /** Where the ball/focus sits for this beat. */
  ball: PitchPos;
  /** Which side is driving the beat (the attacking team, or the free-kick taker). */
  possession: 'home' | 'away';
  /** What the viewer stages at this keyframe. */
  action: PlayAction;
  /** The underlying engine event, or null for the kickoff / final whistle frames. */
  event: MatchEvent | null;
  /** Running home score at this keyframe. */
  home: number;
  /** Running away score at this keyframe. */
  away: number;
}

/** Engine event type -> staged action. 1:1 today, but kept explicit for clarity. */
const ACTION: Record<EventType, PlayAction> = {
  goal: 'goal',
  chance: 'chance',
  yellow: 'yellow',
  secondYellow: 'secondYellow',
  red: 'red',
  injury: 'injury',
  saved: 'save',
  offTarget: 'offTarget',
  post: 'post',
  corner: 'corner',
  foul: 'foul',
};

/** Clamp to the playable pitch, leaving a hair of margin off the goal/touch lines. */
function clamp01(v: number): number {
  return Math.max(0.03, Math.min(0.97, v));
}

/**
 * Map an attack depth (0 = midfield, 1 = at the opponent's goal line) to an x
 * for the attacking side. Home attacks toward x = 1, away toward x = 0.
 */
function attackX(side: 'home' | 'away', depth: number): number {
  return side === 'home' ? 0.5 + depth * 0.46 : 0.5 - depth * 0.46;
}

/** Spread a value around the pitch center (0.5) by up to `half` either way. */
function around(center: number, half: number, r: number): number {
  return center + (r - 0.5) * 2 * half;
}

/** Where on the pitch a given event is staged, from a per-event deterministic RNG. */
function positionFor(event: MatchEvent, index: number): { ball: PitchPos; possession: 'home' | 'away' } {
  // Seed is derived purely from stable, result-defined fields so replays match.
  const rng = createRng(hashSeed('viewer', index, event.min, event.type, event.team, event.playerId));
  const r1 = rng.next01();
  const r2 = rng.next01();
  const atk = event.team;
  const opp = atk === 'home' ? 'away' : 'home';

  switch (event.type) {
    case 'goal':
      return { ball: { x: clamp01(attackX(atk, 0.86 + r1 * 0.08)), y: clamp01(around(0.5, 0.17, r2)) }, possession: atk };
    case 'saved':
      return { ball: { x: clamp01(attackX(atk, 0.82 + r1 * 0.08)), y: clamp01(around(0.5, 0.18, r2)) }, possession: atk };
    case 'chance':
      return { ball: { x: clamp01(attackX(atk, 0.78 + r1 * 0.1)), y: clamp01(around(0.5, 0.26, r2)) }, possession: atk };
    case 'offTarget':
      return { ball: { x: clamp01(attackX(atk, 0.76 + r1 * 0.1)), y: clamp01(around(0.5, 0.34, r2)) }, possession: atk };
    case 'post':
      return { ball: { x: clamp01(attackX(atk, 0.84 + r1 * 0.06)), y: clamp01(around(0.5, 0.3, r2)) }, possession: atk };
    case 'corner':
      // Right at the attacking end, hard against one of the two corner flags.
      return { ball: { x: clamp01(attackX(atk, 0.95 + r1 * 0.03)), y: r2 < 0.5 ? 0.05 : 0.95 }, possession: atk };
    case 'foul':
    case 'yellow':
    case 'secondYellow':
    case 'red': {
      // Discipline happens around the carded side's own half/midfield; the
      // opponent takes the resulting free kick.
      const x = atk === 'home' ? 0.3 + r1 * 0.28 : 0.7 - r1 * 0.28;
      return { ball: { x: clamp01(x), y: clamp01(around(0.5, 0.4, r2)) }, possession: opp };
    }
    case 'injury':
      // Play can break down anywhere; keep the carded side on the ball.
      return { ball: { x: clamp01(0.3 + r1 * 0.4), y: clamp01(around(0.5, 0.42, r2)) }, possession: atk };
  }
}

/**
 * Turn a played match into the ordered keyframes the 2D viewer renders: kickoff
 * at the center circle, one positioned beat per engine event (in event order),
 * and the final whistle. Each frame also carries the running score so the viewer
 * can drive a live scoreboard. Presentation only — nothing here is fed back into
 * the simulation.
 */
export function buildMatchFrames(result: MatchResult): MatchFrame[] {
  const frames: MatchFrame[] = [
    { min: 0, ball: { x: 0.5, y: 0.5 }, possession: 'home', action: 'kickoff', event: null, home: 0, away: 0 },
  ];

  let home = 0;
  let away = 0;
  result.events.forEach((event, index) => {
    if (event.type === 'goal') {
      if (event.team === 'home') home += 1;
      else away += 1;
    }
    const { ball, possession } = positionFor(event, index);
    frames.push({ min: event.min, ball, possession, action: ACTION[event.type], event, home, away });
  });

  frames.push({
    min: 90,
    ball: { x: 0.5, y: 0.5 },
    possession: 'home',
    action: 'final',
    event: null,
    home: result.homeGoals,
    away: result.awayGoals,
  });
  return frames;
}
