import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Despacho } from './Despacho';
import { useGameStore } from '@ui/store/gameStore';

/** Reset the store and start a fresh 96/97 career managing Barcelona. */
function startGame(): void {
  useGameStore.setState({ career: null, season: null, screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('Despacho (Mister office shell)', () => {
  beforeEach(startGame);

  it('shows the club identity and live header data', () => {
    render(<Despacho />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    // puesto/pts/saldo on the club side of the header bar.
    expect(screen.getByText(/en Liga/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo/)).toBeInTheDocument();
    // competition slot shows the season and matchdays played.
    expect(screen.getByText('96/97')).toBeInTheDocument();
    expect(screen.getByText(/Jugadas \d+ de \d+/)).toBeInTheDocument();
  });

  it('shows the rival curiosities ticker tag', () => {
    render(<Despacho />);
    expect(screen.getByText(/¿Sabías que/)).toBeInTheDocument();
  });

  it('renders the next league fixture in the próximos-partidos bar', () => {
    render(<Despacho />);
    // The league card (and header) carry the matchday label of the upcoming fixture.
    expect(screen.getAllByText(/Jornada \d+/).length).toBeGreaterThan(0);
  });

  it('renders the tower sections and navigates when one is clicked', () => {
    render(<Despacho />);
    for (const label of [
      'Alineación',
      'Táctica',
      'Clasificación',
      'Directiva',
      'Fichajes',
      'Personal',
      'Finanzas',
      'Estadio',
      'Prensa',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    screen.getByRole('button', { name: /Alineación/ }).click();
    expect(useGameStore.getState().screen).toBe('squad');
  });

  it('plays the matchday from the office (→ prematch)', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: /Jugar jornada/ }).click();
    expect(useGameStore.getState().screen).toBe('prematch');
  });

  it('keeps save reachable from the office', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: 'Guardar' }).click();
    expect(useGameStore.getState().screen).toBe('slots');
  });
});
