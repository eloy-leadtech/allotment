import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayerTag } from './PlayerTag';
import { Flag, hasFlag, normalizeCountry } from './Flag';
import { ratingTier } from './rating';

describe('PlayerTag', () => {
  it('renders dorsal, flag, name and line-coloured badge', () => {
    const { container } = render(
      <PlayerTag nombre="Celso Ayala" posicion="DEF" dorsal={5} nacionalidad="Paraguay" />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Celso Ayala')).toBeInTheDocument();
    expect(container.querySelector('.pos-badge--DEF')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Paraguay' })).toBeInTheDocument();
  });

  it('renders a quiet dot when the dorsal is null (pre-1995 seasons)', () => {
    const { container } = render(<PlayerTag nombre="Prats" posicion="POR" dorsal={null} />);
    expect(container.querySelector('.mst-jg__d')?.textContent).toBe('·');
  });

  it('shows the media only when provided, and honours sinDorsal', () => {
    const { container } = render(
      <PlayerTag nombre="Finidi" posicion="DEL" nacionalidad="Nigeria" media={86} sinDorsal />,
    );
    expect(container.querySelector('.mst-jg__m')?.textContent).toBe('86');
    expect(container.querySelector('.mst-jg__d')).toBeNull();
  });

  it('prefers the fine demarcation label over the line when given', () => {
    render(<PlayerTag nombre="Jaime" posicion="DEF" posLabel="LATI" />);
    expect(screen.getByText('LATI')).toBeInTheDocument();
  });
});

describe('Flag', () => {
  it('normalizes accented Spanish country names', () => {
    expect(normalizeCountry('República Checa')).toBe('republicacheca');
    expect(normalizeCountry('España')).toBe('espana');
    expect(hasFlag('Rumanía')).toBe(true);
    expect(hasFlag('Unión Soviética')).toBe(true);
  });

  it('draws known flags and falls back to initials for unknown ones', () => {
    const { container } = render(<Flag country="España" />);
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(2);
    const { container: c2 } = render(<Flag country="Atlántida" />);
    expect(c2.querySelector('text')?.textContent).toBe('AT');
    const { container: c3 } = render(<Flag country={null} />);
    expect(c3.querySelector('svg')?.getAttribute('aria-label')).toBe('Sin nacionalidad');
  });
});

describe('ratingTier', () => {
  it('maps the 5-level scale of the skin', () => {
    expect(ratingTier(92)).toBe('top');
    expect(ratingTier(88)).toBe('top');
    expect(ratingTier(87)).toBe('alto');
    expect(ratingTier(70)).toBe('medio');
    expect(ratingTier(60)).toBe('bajo');
    expect(ratingTier(40)).toBe('malo');
  });
});
