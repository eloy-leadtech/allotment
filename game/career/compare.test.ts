import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes, Player } from '@data';
import { comparePlayers } from './compare';
import { marketValue } from './market';

const attrs: Attributes = {
  calidad: 70,
  agresividad: 60,
  resistencia: 70,
  velocidad: 70,
  fisico: 65,
  remate: 70,
  ofensivo: 70,
  pase: 70,
  entrada: 60,
  porteria: 20,
};

function makePlayer(over: Partial<Player> & { media: number }): Player {
  return {
    id: over.id ?? `p-${over.media}`,
    nombre: over.nombre ?? 'Test',
    nombreCompleto: over.nombreCompleto ?? 'Test Player',
    posicion: over.posicion ?? 'DEL',
    esPortero: over.esPortero ?? false,
    demarcaciones: [],
    atributos: over.atributos ?? attrs,
    media: over.media,
    dorsal: over.dorsal ?? null,
    fechaNacimiento: over.fechaNacimiento ?? null,
    alturaCm: over.alturaCm ?? null,
    pesoKg: over.pesoKg ?? null,
    nacionalidad: null,
    clubAnterior: null,
  };
}

const YEAR = 1996;
const winnerByKey = (rows: { key: string; winner: string }[], key: string) =>
  rows.find((r) => r.key === key)?.winner;

describe('comparePlayers — ganador por atributo', () => {
  it('flags the higher value as the winner on every attribute', () => {
    const strong = makePlayer({
      id: 'strong',
      media: 85,
      atributos: { ...attrs, calidad: 88, remate: 90, pase: 84 },
    });
    const weak = makePlayer({
      id: 'weak',
      media: 70,
      atributos: { ...attrs, calidad: 60, remate: 55, pase: 50 },
    });
    const cmp = comparePlayers(strong, weak, YEAR);
    // Every attribute is >= for `strong` and strictly greater on three of them.
    expect(cmp.attributes.every((r) => r.winner === 'a' || r.winner === 'tie')).toBe(true);
    expect(winnerByKey(cmp.attributes, 'remate')).toBe('a');
    expect(winnerByKey(cmp.attributes, 'calidad')).toBe('a');
    expect(winnerByKey(cmp.attributes, 'pase')).toBe('a');
    expect(cmp.tally.a).toBe(3);
    expect(cmp.tally.b).toBe(0);
  });

  it('splits per-attribute winners when each is stronger somewhere', () => {
    const a = makePlayer({ id: 'a', media: 78, atributos: { ...attrs, remate: 90, pase: 40 } });
    const b = makePlayer({ id: 'b', media: 78, atributos: { ...attrs, remate: 40, pase: 90 } });
    const cmp = comparePlayers(a, b, YEAR);
    expect(winnerByKey(cmp.attributes, 'remate')).toBe('a');
    expect(winnerByKey(cmp.attributes, 'pase')).toBe('b');
    expect(cmp.tally).toEqual({ a: 1, b: 1, ties: 8 });
  });

  it('the attribute tally always covers exactly the 10 attributes', () => {
    const cmp = comparePlayers(makePlayer({ media: 80 }), makePlayer({ media: 60 }), YEAR);
    expect(cmp.attributes).toHaveLength(10);
    expect(cmp.tally.a + cmp.tally.b + cmp.tally.ties).toBe(10);
  });
});

describe('comparePlayers — empates', () => {
  it('reports a tie on equal attributes', () => {
    const a = makePlayer({ id: 'a', media: 75 });
    const b = makePlayer({ id: 'b', media: 75 });
    const cmp = comparePlayers(a, b, YEAR);
    expect(cmp.attributes.every((r) => r.winner === 'tie')).toBe(true);
    expect(cmp.tally).toEqual({ a: 0, b: 0, ties: 10 });
  });

  it('an identical player against itself ties everything and the verdict is a tie', () => {
    const p = makePlayer({ id: 'p', media: 75, fechaNacimiento: '1972-01-01', alturaCm: 180, pesoKg: 75 });
    const cmp = comparePlayers(p, p, YEAR);
    expect(cmp.metrics.every((r) => r.winner === 'tie')).toBe(true);
    expect(cmp.overall).toBe('tie');
  });

  it('treats an unknown attribute (reduced-record calidad) as a tie, never a win', () => {
    const known = makePlayer({ id: 'known', media: 75, atributos: { ...attrs, calidad: 90 } });
    const reduced = makePlayer({ id: 'reduced', media: 75, atributos: { ...attrs, calidad: null } });
    const cmp = comparePlayers(known, reduced, YEAR);
    expect(winnerByKey(cmp.attributes, 'calidad')).toBe('tie');
    // The reverse order must not turn the null into a win either.
    const rev = comparePlayers(reduced, known, YEAR);
    expect(winnerByKey(rev.attributes, 'calidad')).toBe('tie');
  });
});

describe('comparePlayers — metrics (media + valor de mercado)', () => {
  it('flags the higher media and prices market value via marketValue', () => {
    const a = makePlayer({ id: 'a', media: 84, fechaNacimiento: '1971-06-01' });
    const b = makePlayer({ id: 'b', media: 72, fechaNacimiento: '1971-06-01' });
    const cmp = comparePlayers(a, b, YEAR);
    expect(winnerByKey(cmp.metrics, 'media')).toBe('a');
    const valor = cmp.metrics.find((r) => r.key === 'valor')!;
    expect(valor.a).toBe(marketValue(a, 25));
    expect(valor.b).toBe(marketValue(b, 25));
    expect(valor.winner).toBe('a');
  });

  it('exposes edad, posición, altura and peso as descriptive info (no winner)', () => {
    const a = makePlayer({ id: 'a', media: 80, posicion: 'DEL', fechaNacimiento: '1974-01-01', alturaCm: 185, pesoKg: 80 });
    const b = makePlayer({ id: 'b', media: 70, posicion: 'DEF', fechaNacimiento: '1970-01-01', alturaCm: 178, pesoKg: 72 });
    const cmp = comparePlayers(a, b, YEAR);
    const info = Object.fromEntries(cmp.info.map((r) => [r.key, r]));
    expect(info.edad!.a).toBe('22 años');
    expect(info.edad!.b).toBe('26 años');
    expect(info.posicion!.a).toBe('Delantero');
    expect(info.posicion!.b).toBe('Defensa');
    expect(info.altura!.a).toBe('185 cm');
    expect(info.peso!.b).toBe('72 kg');
  });

  it('renders unknown descriptive fields as an em dash', () => {
    const a = makePlayer({ id: 'a', media: 70 });
    const cmp = comparePlayers(a, a, YEAR);
    const info = Object.fromEntries(cmp.info.map((r) => [r.key, r]));
    expect(info.edad!.a).toBe('—');
    expect(info.altura!.a).toBe('—');
    expect(info.peso!.a).toBe('—');
  });
});

describe('comparePlayers — overall verdict', () => {
  it('goes to whoever wins more attributes', () => {
    const a = makePlayer({ id: 'a', media: 70, atributos: { ...attrs, remate: 90, pase: 90 } });
    const b = makePlayer({ id: 'b', media: 70, atributos: { ...attrs, remate: 40, pase: 40 } });
    expect(comparePlayers(a, b, YEAR).overall).toBe('a');
  });

  it('breaks an attribute tie by the higher media', () => {
    const a = makePlayer({ id: 'a', media: 82, atributos: { ...attrs, remate: 90, pase: 40 } });
    const b = makePlayer({ id: 'b', media: 74, atributos: { ...attrs, remate: 40, pase: 90 } });
    const cmp = comparePlayers(a, b, YEAR);
    expect(cmp.tally).toEqual({ a: 1, b: 1, ties: 8 }); // attribute tie
    expect(cmp.overall).toBe('a'); // decided by media
  });
});

describe('comparePlayers — determinism & symmetry', () => {
  it('is deterministic: identical inputs produce a deep-equal result', () => {
    const a = makePlayer({ id: 'a', media: 83, fechaNacimiento: '1970-03-03', alturaCm: 182, pesoKg: 77 });
    const b = makePlayer({ id: 'b', media: 77, fechaNacimiento: '1973-09-09', alturaCm: 175, pesoKg: 70 });
    expect(comparePlayers(a, b, YEAR)).toEqual(comparePlayers(a, b, YEAR));
  });

  it('is symmetric: swapping the players mirrors every winner', () => {
    const a = makePlayer({ id: 'a', media: 84, atributos: { ...attrs, remate: 90, entrada: 40 } });
    const b = makePlayer({ id: 'b', media: 71, atributos: { ...attrs, remate: 40, entrada: 90 } });
    const ab = comparePlayers(a, b, YEAR);
    const ba = comparePlayers(b, a, YEAR);
    const flip = (s: string) => (s === 'a' ? 'b' : s === 'b' ? 'a' : 'tie');
    for (const row of ab.attributes) {
      expect(ba.attributes.find((r) => r.key === row.key)!.winner).toBe(flip(row.winner));
    }
    expect(ba.overall).toBe(flip(ab.overall));
    expect(ba.tally).toEqual({ a: ab.tally.b, b: ab.tally.a, ties: ab.tally.ties });
  });

  it('does not mutate the players it is given', () => {
    const a = makePlayer({ id: 'a', media: 80 });
    const b = makePlayer({ id: 'b', media: 70 });
    const snapshot = JSON.stringify([a, b]);
    comparePlayers(a, b, YEAR);
    expect(JSON.stringify([a, b])).toBe(snapshot);
  });
});

describe('comparePlayers — real 96/97 data', () => {
  it('compares two real players deterministically', () => {
    const league = loadPrimera9697();
    const players = league.equipos.flatMap((t) => t.jugadores);
    const a = players[0]!;
    const b = players[1]!;
    const cmp = comparePlayers(a, b, 1996);
    expect(cmp.attributes).toHaveLength(10);
    expect(cmp.metrics.map((m) => m.key)).toEqual(['media', 'valor']);
    expect(cmp.tally.a + cmp.tally.b + cmp.tally.ties).toBe(10);
    expect(comparePlayers(a, b, 1996)).toEqual(cmp);
  });
});
