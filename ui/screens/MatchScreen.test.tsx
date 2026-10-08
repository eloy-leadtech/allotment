import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { MatchResult } from '@engine';
import { useGameStore } from '@ui/store/gameStore';
import { MatchScreen } from './MatchScreen';

const RESULT: MatchResult = {
  homeId: 'barcelona',
  awayId: 'valencia',
  homeGoals: 2,
  awayGoals: 1,
  events: [
    { min: 12, type: 'goal', team: 'home', playerId: 'p1', playerName: 'Jugador 1' },
    { min: 34, type: 'yellow', team: 'away', playerId: 'p2', playerName: 'Jugador 2' },
    { min: 55, type: 'goal', team: 'away', playerId: 'p3', playerName: 'Jugador 3' },
    { min: 78, type: 'goal', team: 'home', playerId: 'p4', playerName: 'Jugador 4' },
  ],
  derby: false,
};

function openCareerMatch(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
  useGameStore.getState().openMatch(RESULT);
}

describe('MatchScreen', () => {
  beforeAll(() => {
    // jsdom has no 2D canvas context; keep the viewer on its quiet no-op path.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  beforeEach(openCareerMatch);

  it('shows the scoreboard with both teams', () => {
    render(<MatchScreen />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    expect(screen.getByText('Valencia')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Visitante')).toBeInTheDocument();
  });

  it('defaults to the 2D viewer and can toggle to the teletipo', () => {
    render(<MatchScreen />);
    // Viewer by default.
    expect(screen.getByRole('img', { name: /Visor 2D del partido/ })).toBeInTheDocument();
    // Switch to teletipo.
    fireEvent.click(screen.getByRole('button', { name: 'Teletipo' }));
    expect(screen.getByRole('heading', { name: 'Teletipo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Visor 2D del partido/ })).not.toBeInTheDocument();
    // Back to the viewer.
    fireEvent.click(screen.getByRole('button', { name: 'Visor 2D' }));
    expect(screen.getByRole('img', { name: /Visor 2D del partido/ })).toBeInTheDocument();
  });

  it('exposes transport controls that pause and change speed', () => {
    render(<MatchScreen />);
    // Autoplaying: the primary control pauses.
    const pause = screen.getByRole('button', { name: 'Pausar' });
    fireEvent.click(pause);
    // Now paused: it offers to resume.
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeInTheDocument();
    // Speed cycles x1 -> x2.
    const speed = screen.getByRole('button', { name: 'Velocidad x1' });
    fireEvent.click(speed);
    expect(screen.getByRole('button', { name: 'Velocidad x2' })).toBeInTheDocument();
  });

  it('jumps to the final score when skipping to the end', () => {
    render(<MatchScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Final' }));
    // The scoreboard shows the final result and the Final status.
    expect(screen.getByLabelText('Marcador Barcelona 2 - 1 Valencia')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('falls back when there is no match selected', () => {
    useGameStore.setState({ viewingMatch: null });
    render(<MatchScreen />);
    expect(screen.getByText('No hay partido seleccionado.')).toBeInTheDocument();
  });
});
