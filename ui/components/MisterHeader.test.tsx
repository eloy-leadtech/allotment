import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@ui/store/gameStore';
import { MisterHeader } from './MisterHeader';
import { MisterFrame } from './MisterFrame';

function startBarcelonaCareer(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('MisterHeader', () => {
  beforeEach(startBarcelonaCareer);

  it('shows the club, its standing, the budget and the next match', () => {
    const { container } = render(<MisterHeader />);
    expect(container.querySelector('.mst-head__name')?.textContent).toMatch(/Barcelona/i);
    expect(screen.getByText('Próximo partido')).toBeInTheDocument();
    expect(screen.getByText(/Jornada 1/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo/)).toBeInTheDocument();
    expect(screen.getByText(/Jugadas 0 de \d+/)).toBeInTheDocument();
    // Both crests peek out of the bar.
    expect(container.querySelectorAll('.mst-head__esc').length).toBe(2);
  });

  it('renders nothing without a career', () => {
    useGameStore.setState({ career: null, season: null });
    const { container } = render(<MisterHeader />);
    expect(container.firstChild).toBeNull();
  });
});

describe('MisterFrame', () => {
  it('renders header and content inside the fixed console', () => {
    const { container } = render(
      <MisterFrame header={<div data-testid="hd" />}>
        <p>contenido</p>
      </MisterFrame>,
    );
    expect(container.querySelector('.mst-console')).toBeTruthy();
    expect(container.querySelector('.mst-console__grain')).toBeTruthy();
    expect(screen.getByTestId('hd')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
