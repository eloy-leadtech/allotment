import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { buildMatchFrames, simulateMatch } from '@engine';
import type { Line, MatchPlayer, MatchTeam } from '@engine';
import { Match2D } from './Match2D';

function makeTeam(id: string): MatchTeam {
  const lines: Line[] = ['DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'MED', 'DEF', 'DEL', 'MED'];
  const players: MatchPlayer[] = [
    { id: `${id}-gk`, nombre: `${id} GK`, posicion: 'POR', esPortero: true, media: 70, remate: 10, ofensivo: 10, pase: 20, entrada: 20, porteria: 70 },
    ...lines.map((posicion, i) => ({
      id: `${id}-${i}`,
      nombre: `${id} ${i}`,
      posicion,
      esPortero: false,
      media: 70,
      remate: 70,
      ofensivo: 70,
      pase: 70,
      entrada: 70,
      porteria: 10,
    })),
  ];
  return { id, nombre: id, players };
}

const frames = buildMatchFrames(
  simulateMatch({ home: makeTeam('home'), away: makeTeam('away'), seed: 7 }),
);

describe('Match2D', () => {
  // jsdom has no 2D canvas context: make getContext return null quietly so the
  // component takes its no-op path (and no "Not implemented" noise is logged).
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('renders an accessible canvas without crashing when there is no 2D context', () => {
    const { container } = render(
      <Match2D frames={frames} getProgress={() => 0} homeName="Local" awayName="Visitante" />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(screen.getByRole('img', { name: /Visor 2D del partido Local contra Visitante/ })).toBeInTheDocument();
  });

  it('renders statically under reduced motion', () => {
    const getProgress = vi.fn(() => frames.length - 1);
    const { container } = render(
      <Match2D frames={frames} getProgress={getProgress} homeName="A" awayName="B" reduced />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
