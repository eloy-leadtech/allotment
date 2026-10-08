import { describe, it, expect } from 'vitest';
import { nationalCups, nationalCupFor, catalogCountries } from './index';

describe('national-cup registry', () => {
  it('validates against the schema and has unique country codes and ids', () => {
    const cups = nationalCups();
    expect(cups.length).toBeGreaterThan(0);
    const countries = new Set(cups.map((c) => c.country));
    const ids = new Set(cups.map((c) => c.id));
    expect(countries.size).toBe(cups.length);
    expect(ids.size).toBe(cups.length);
  });

  it('maps the main countries to their real cup', () => {
    expect(nationalCupFor('ESP').nombre).toBe('Copa del Rey');
    expect(nationalCupFor('ITA').nombre).toBe('Coppa Italia');
    expect(nationalCupFor('ENG').nombre).toBe('FA Cup');
  });

  it('falls back to a generic cup for an unregistered country', () => {
    const cup = nationalCupFor('ZZZ');
    expect(cup.nombre).toBe('Copa Nacional');
    expect(cup.id).toBe('zzz-cup');
    expect(cup.country).toBe('ZZZ');
  });

  it('gives every catalogue country a cup (explicit or fallback)', () => {
    for (const { code } of catalogCountries()) {
      const cup = nationalCupFor(code);
      expect(cup.nombre.length).toBeGreaterThan(0);
      expect(cup.id.length).toBeGreaterThan(0);
    }
  });
});
