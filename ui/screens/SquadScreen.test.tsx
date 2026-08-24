import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@ui/store/gameStore';
import { SquadScreen } from './SquadScreen';

function startBarcelonaCareer(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('SquadScreen (Mister)', () => {
  beforeEach(startBarcelonaCareer);

  it('lists the squad grouped by line with the unified player tag', () => {
    const { container } = render(<SquadScreen />);
    expect(screen.getByText('Ronaldo')).toBeInTheDocument();
    const groups = [...container.querySelectorAll('.mst-dt__group')].map((g) => g.textContent);
    expect(groups).toContain('Porteros');
    expect(groups).toContain('Delanteros');
    // Every row renders through PlayerTag; bundled DBs have no dorsal yet, so
    // the quiet dot placeholder must show instead (pre-1995 fidelity).
    expect(container.querySelectorAll('.mst-jg').length).toBeGreaterThan(10);
    expect(container.querySelector('.mst-jg__d')?.textContent).toBe('·');
  });

  it('shows the club in the persistent header', () => {
    const { container } = render(<SquadScreen />);
    expect(container.querySelector('.mst-head__name')?.textContent).toMatch(/Barcelona/i);
  });

  it('shows fatigue and desire per player in the management view', () => {
    const { container } = render(<SquadScreen />);
    expect(screen.getByText('Físico')).toBeInTheDocument();
    expect(screen.getByText('Deseo')).toBeInTheDocument();
    expect(container.querySelectorAll('.fatigue-bar').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.desire-badge').length).toBeGreaterThan(0);
  });

  it('switches to the attribute sheet view', () => {
    const { container } = render(<SquadScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Atributos' }));
    expect(container.querySelectorAll('.at').length).toBeGreaterThan(20);
    expect(container.querySelectorAll('.fatigue-bar').length).toBe(0);
  });

  it('opens the inline ficha with attribute bars and the scouted range for a youth', () => {
    const { container } = render(<SquadScreen />);
    fireEvent.click(screen.getByText('Ronaldo').closest('[role="button"]')!);
    // Ronaldo (age 20 in 96/97) is a youth, so the scouted range must appear.
    expect(container.querySelector('.mst-ficha')).toBeTruthy();
    expect(container.querySelectorAll('.mst-attr').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.potrange').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Renovar' })).toBeInTheDocument();
  });

  it('filters by line', () => {
    const { container } = render(<SquadScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Porteros' }));
    const groups = [...container.querySelectorAll('.mst-dt__group')].map((g) => g.textContent);
    expect(groups).toEqual(['Porteros']);
  });

  it('renders a menu fallback when there is no career', () => {
    useGameStore.setState({ career: null, season: null });
    render(<SquadScreen />);
    expect(screen.getByText('No hay carrera en curso.')).toBeInTheDocument();
  });
});
