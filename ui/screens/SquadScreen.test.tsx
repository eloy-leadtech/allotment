import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@ui/store/gameStore';
import { SquadScreen } from './SquadScreen';

function startBarcelonaCareer(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('SquadScreen', () => {
  beforeEach(startBarcelonaCareer);

  it('lists your squad with a scouted potential range for a youth', () => {
    const { container } = render(<SquadScreen />);
    // Ronaldo (age 20 in 96/97) is a youth, so a scouted range must appear.
    expect(screen.getByText('Ronaldo')).toBeInTheDocument();
    const ranges = container.querySelectorAll('.potrange');
    expect(ranges.length).toBeGreaterThan(0);
  });

  it('shows the header with your team name', () => {
    render(<SquadScreen />);
    expect(screen.getAllByText('Barcelona').length).toBeGreaterThan(0);
  });

  it('shows a physical-condition (fatiga) indicator per player', () => {
    const { container } = render(<SquadScreen />);
    expect(screen.getByText('Físico')).toBeInTheDocument();
    // A fatigue bar is rendered for the squad rows.
    expect(container.querySelectorAll('.fatigue-bar').length).toBeGreaterThan(0);
  });

  it('renders a menu fallback when there is no career', () => {
    useGameStore.setState({ career: null, season: null });
    render(<SquadScreen />);
    expect(screen.getByText('No hay carrera en curso.')).toBeInTheDocument();
  });
});
