import { describe, it, expect } from 'vitest';
import { getEstadio } from './estadios';

describe('getEstadio', () => {
  it('returns a known stadium with name and capacity', () => {
    const camp = getEstadio('barcelona');
    expect(camp?.nombre).toBe('Camp Nou');
    expect(camp?.aforo).toBeGreaterThan(0);
  });

  it('resolves another club', () => {
    expect(getEstadio('sevilla')?.nombre).toBe('Ramón Sánchez Pizjuán');
  });

  it('returns undefined for a club without stadium data', () => {
    expect(getEstadio('no-such-club')).toBeUndefined();
  });
});
