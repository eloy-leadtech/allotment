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

describe('Despacho (Mister office hub)', () => {
  beforeEach(startGame);

  it('shows the club, its standing, the matchday and the next-match bar', () => {
    render(<Despacho />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
    expect(screen.getByText(/en Liga/)).toBeInTheDocument();
    // "J1" appears in the date and in the next-match bar, so there may be several.
    expect(screen.getAllByText(/J1/).length).toBeGreaterThan(0);
    // The "próximo partido" bar is always present (even before it is known).
    expect(screen.getByText(/Próximo partido/i)).toBeInTheDocument();
  });

  it('navigates through the section towers (no tab strip)', () => {
    render(<Despacho />);
    for (const label of [
      'Alineación',
      'Táctica',
      'Clasificación',
      'Fichajes',
      'Directiva',
      'Prensa',
      'Palmarés',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('opens the squad from the Alineación tower button', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: /Alineación/ }).click();
    expect(useGameStore.getState().screen).toBe('squad');
  });

  it('advances the matchday from the office (Simular) keeping the hub on screen', () => {
    render(<Despacho />);
    expect(useGameStore.getState().season?.currentMatchday).toBe(1);
    screen.getByRole('button', { name: /Simular jornada/ }).click();
    expect(useGameStore.getState().season?.currentMatchday).toBe(2);
  });

  it('plays the matchday from the central call to action', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: /Jugar jornada/ }).click();
    expect(useGameStore.getState().screen).toBe('prematch');
  });
});
