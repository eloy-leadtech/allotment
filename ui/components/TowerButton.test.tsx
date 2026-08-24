import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TowerButton } from './TowerButton';

describe('TowerButton', () => {
  it('renders the name, the hint and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <TowerButton
        name="Alineación"
        hint={
          <>
            <em>2</em> sin cubrir
          </>
        }
        hintTone="alert"
        onClick={onClick}
      />,
    );
    expect(screen.getByRole('button', { name: /Alineación/ })).toBeInTheDocument();
    expect(screen.getByText('sin cubrir', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('tints the hint by tone and shows the warning pip with its label', () => {
    const { container } = render(
      <TowerButton
        name="Fichajes"
        hint="Oferta pendiente"
        pip="alert"
        pipLabel="Requiere respuesta"
        onClick={() => {}}
      />,
    );
    expect(container.querySelector('.mst-pip')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Requiere respuesta' })).toBeInTheDocument();
    // Amber variant gets the --q modifier.
    const { container: c2 } = render(
      <TowerButton name="Personal" pip="pending" onClick={() => {}} />,
    );
    expect(c2.querySelector('.mst-pip--q')).toBeTruthy();
  });

  it('respects disabled', () => {
    const onClick = vi.fn();
    render(<TowerButton name="Estadio" disabled onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Estadio/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
