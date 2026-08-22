import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@ui/store/gameStore';
import { ComparativaScreen } from './ComparativaScreen';

function startBarcelonaCareer(): void {
  useGameStore.setState({ career: null, season: null, retainIds: [], screen: 'title' });
  useGameStore.getState().chooseSeason('es-primera-9697');
  useGameStore.getState().startCareer('barcelona');
}

describe('ComparativaScreen', () => {
  beforeEach(startBarcelonaCareer);

  it('renders the head-to-head with the 10 attributes and the metric rows', () => {
    const { container } = render(<ComparativaScreen />);
    expect(screen.getByText('Comparativa')).toBeInTheDocument();
    // The scored rows: 10 attributes + media + valor de mercado = 12 bar rows.
    expect(container.querySelectorAll('.compare-row').length).toBe(12);
    // Descriptive fields (edad, posición, altura, peso) render as info rows.
    expect(container.querySelectorAll('.compare-inforow').length).toBe(4);
    expect(screen.getByText('Valor de mercado')).toBeInTheDocument();
  });

  it('defaults to the squad and reacts to picking another player', () => {
    const { container } = render(<ComparativaScreen />);
    const [firstSelect] = container.querySelectorAll<HTMLSelectElement>('.compare-select');
    expect(firstSelect).toBeTruthy();
    const options = firstSelect!.querySelectorAll('option');
    const other = Array.from(options).find((o) => o.value !== firstSelect!.value);
    expect(other).toBeTruthy();
    fireEvent.change(firstSelect!, { target: { value: other!.value } });
    expect(firstSelect!.value).toBe(other!.value);
    // Still a valid comparison after the change.
    expect(container.querySelectorAll('.compare-row').length).toBe(12);
  });

  it('renders a menu fallback when there is no career', () => {
    useGameStore.setState({ career: null, season: null });
    render(<ComparativaScreen />);
    expect(screen.getByText('No hay carrera en curso.')).toBeInTheDocument();
  });
});
