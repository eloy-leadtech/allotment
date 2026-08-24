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

describe('Despacho (Mister hub)', () => {
  beforeEach(startGame);

  it('shows the club and the season in the persistent header', () => {
    const { container } = render(<Despacho />);
    expect(container.querySelector('.mst-head__name')?.textContent).toMatch(/Barcelona/i);
    expect(screen.getByText(/96\/97/)).toBeInTheDocument();
    // The old PCF7 bitmap is gone.
    expect(container.querySelector('.despacho7')).toBeNull();
  });

  it('renders every section as a tower button, so no screen is orphaned', () => {
    render(<Despacho />);
    for (const label of [
      'Plantilla',
      'Táctica',
      'Entrenamiento',
      'Cantera',
      'Promesas',
      'Ojeador',
      'Clasificación',
      'Estadísticas',
      'Comparativa',
      'Directiva',
      'Cuerpo técnico',
      'Estadio',
      'Fichajes',
      'Patrocinio',
      'Prensa',
      'Palmarés',
      'Hemeroteca',
      'Guardar',
      'Menú',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('navigates to a section when its tower button is clicked', () => {
    render(<Despacho />);
    screen.getByRole('button', { name: /Plantilla/ }).click();
    expect(useGameStore.getState().screen).toBe('squad');
  });

  it('shows the next rival card and the play zone', () => {
    const { container } = render(<Despacho />);
    expect(container.querySelectorAll('.mst-fx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Jugar jornada/ })).toBeInTheDocument();
  });

  it('advances the matchday from the office (Simular) keeping the hub on screen', () => {
    render(<Despacho />);
    expect(useGameStore.getState().season?.currentMatchday).toBe(1);
    screen.getByRole('button', { name: 'Simular jornada' }).click();
    expect(useGameStore.getState().season?.currentMatchday).toBe(2);
  });
});
