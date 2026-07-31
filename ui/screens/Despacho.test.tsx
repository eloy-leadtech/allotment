import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Despacho } from './Despacho';
import { useGameStore } from '@ui/store/gameStore';

/** Reset the store and start a fresh 96/97 career managing Barcelona. */
function startGame(): void {
  useGameStore.setState({ career: null, season: null, screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('Despacho (PCF7 office hub)', () => {
  beforeEach(startGame);

  it('shows the club and competition live data over the plates', () => {
    render(<Despacho />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    expect(screen.getByText(/LIGA · 96\/97/)).toBeInTheDocument();
    expect(screen.getByText(/Jornada 1\/\d+/)).toBeInTheDocument();
  });

  it('renders the 12 icon hotspots plus the play zone with accessible labels', () => {
    render(<Despacho />);
    // Labels unique to the icon column (not shared with a bottom tab).
    for (const label of [
      'Resultados',
      'Calendario',
      'Finanzas',
      'Prensa',
      'Directiva',
      'Fichajes',
      'Alineación',
      'Ojeador',
      'Vídeo',
      'Entrenamiento',
      'Estadio',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // "Táctica" appears both as an icon hotspot and as a bottom tab.
    expect(screen.getAllByRole('button', { name: 'Táctica' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Jugar jornada' })).toBeInTheDocument();
  });

  it('navigates to an existing section when its icon is clicked', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: 'Alineación' }).click();
    expect(useGameStore.getState().screen).toBe('squad');
  });

  it('advances the matchday from the office (Simular) keeping the hub on screen', () => {
    render(<Despacho />);
    expect(useGameStore.getState().season?.currentMatchday).toBe(1);
    screen.getByRole('button', { name: 'Simular jornada' }).click();
    expect(useGameStore.getState().season?.currentMatchday).toBe(2);
  });

  it('marks Liga as the active bottom tab', () => {
    render(<Despacho />);
    const liga = screen.getByRole('button', { name: 'Liga' });
    expect(liga).toHaveAttribute('aria-current', 'page');
    // The 9-tab strip is present.
    const tabStrip = liga.parentElement!;
    expect(within(tabStrip).getAllByRole('button')).toHaveLength(9);
  });
});
