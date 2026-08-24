import { describe, expect, it } from 'vitest';
import {
  brevesDelDia,
  lunesDe,
  personajesDelDia,
  suplementoDelDia,
  temporadaLarga,
  type PiezaDeportiva,
  type SuplementoTemporada,
} from './suplemento';

function pieza(over: Partial<PiezaDeportiva> = {}): PiezaDeportiva {
  return {
    titular: 'TITULAR',
    cuerpo: 'Cuerpo.',
    marcador: '1-0',
    seccion: 'la Liga española',
    pais: 'ESP',
    division: '1',
    tipo: 'goleada',
    equipos: ['Alavés', 'Mallorca'],
    ...over,
  };
}

function temporada(semanas: Record<string, PiezaDeportiva[]>): SuplementoTemporada {
  return { temporada: '1998-99', semanas };
}

describe('lunesDe', () => {
  it('lleva cualquier día al lunes de su semana', () => {
    expect(lunesDe('1999-03-07')).toBe('1999-03-01'); // domingo
    expect(lunesDe('1999-03-01')).toBe('1999-03-01'); // lunes
    expect(lunesDe('1999-03-04')).toBe('1999-03-01'); // jueves
  });
});

describe('suplementoDelDia', () => {
  it('aparta lo que tenga que ver con tu propio club', () => {
    const t = temporada({
      '1999-03-01': [
        pieza({ titular: 'TUYO', equipos: ['Celta de Vigo', 'Betis'] }),
        pieza({ titular: 'AJENO', equipos: ['Alavés', 'Mallorca'] }),
      ],
    });
    const p = suplementoDelDia(t, '1999-03-07', 5, 'ESP', 'Betis');
    expect(p.map((x) => x.titular)).toEqual(['AJENO']);
  });

  it('pone primero la liga de casa', () => {
    const t = temporada({
      '1999-03-01': [
        pieza({ titular: 'ITALIA', pais: 'ITA', equipos: ['Lazio'] }),
        pieza({ titular: 'CASA', pais: 'ESP', equipos: ['Alavés'] }),
      ],
    });
    expect(suplementoDelDia(t, '1999-03-07', 5, 'ESP')[0]?.titular).toBe('CASA');
  });

  it('no deja más de dos piezas del mismo país', () => {
    const t = temporada({
      '1999-03-01': [
        pieza({ titular: 'A', equipos: ['A'] }),
        pieza({ titular: 'B', equipos: ['B'] }),
        pieza({ titular: 'C', equipos: ['C'] }),
      ],
    });
    expect(suplementoDelDia(t, '1999-03-07', 5, 'ESP')).toHaveLength(2);
  });

  it('no deja más de dos piezas del mismo tipo aunque sean de países distintos', () => {
    const t = temporada({
      '1999-03-01': [
        pieza({ titular: 'A', tipo: 'goleada', pais: 'ITA', equipos: ['A'] }),
        pieza({ titular: 'B', tipo: 'goleada', pais: 'GER', equipos: ['B'] }),
        pieza({ titular: 'C', tipo: 'goleada', pais: 'FRA', equipos: ['C'] }),
        pieza({ titular: 'D', tipo: 'sorpresa', pais: 'HOL', equipos: ['D'] }),
      ],
    });
    const p = suplementoDelDia(t, '1999-03-07', 5, 'ESP');
    expect(p.filter((x) => x.tipo === 'goleada')).toHaveLength(2);
    // la campanada pesa más que la goleada, así que abre la página
    expect(p[0]?.titular).toBe('D');
  });

  it('solo admite una racha por página', () => {
    const t = temporada({
      '1999-03-01': [
        pieza({ titular: 'R1', tipo: 'racha', pais: 'ITA', equipos: ['X'] }),
        pieza({ titular: 'R2', tipo: 'racha', pais: 'GER', equipos: ['Y'] }),
      ],
    });
    expect(suplementoDelDia(t, '1999-03-07', 5, 'ESP')).toHaveLength(1);
  });

  it('devuelve vacío si no hay temporada cargada o la semana está muda', () => {
    expect(suplementoDelDia(null, '1999-03-07')).toEqual([]);
    expect(suplementoDelDia(temporada({}), '1999-03-07')).toEqual([]);
  });
});

describe('temporadaLarga', () => {
  it('traduce como nombra el juego la temporada al nombre del archivo', () => {
    expect(temporadaLarga('98/99')).toBe('1998-99');
    expect(temporadaLarga('05/06')).toBe('2005-06');
    expect(temporadaLarga('28/29')).toBe('1928-29');
    expect(temporadaLarga('1998-99')).toBe('1998-99');
    expect(temporadaLarga('vaya')).toBeNull();
  });
});

describe('brevesDelDia', () => {
  it('no repite lo que ya salió en la primera página', () => {
    const a = pieza({ titular: 'A', equipos: ['A'] });
    const b = pieza({ titular: 'B', equipos: ['B'] });
    const t = temporada({ '1999-03-01': [a, b] });
    expect(brevesDelDia(t, '1999-03-07', [a]).map((x) => x.titular)).toEqual(['B']);
  });

  it('también aparta tu propio club', () => {
    const t = temporada({
      '1999-03-01': [pieza({ titular: 'TUYO', equipos: ['Betis'] })],
    });
    expect(brevesDelDia(t, '1999-03-07', [], 6, 'Betis')).toEqual([]);
  });
});

describe('personajesDelDia', () => {
  const p = (titular: string, pais: string, media: number) => ({
    clase: 'debut' as const,
    titular,
    cuerpo: '',
    marcador: '',
    seccion: 'Cantera',
    club: 'X',
    pais,
    media,
  });

  it('pone delante los de casa y, dentro de casa, a los más conocidos', () => {
    const t: SuplementoTemporada = {
      temporada: '1998-99',
      semanas: {},
      personajes: {
        '1999-03-01': [p('ITALIANO', 'ITA', 90), p('MODESTO', 'ESP', 74), p('CRACK', 'ESP', 88)],
      },
    };
    expect(personajesDelDia(t, '1999-03-07', 3, 'ESP').map((x) => x.titular)).toEqual([
      'CRACK',
      'MODESTO',
      'ITALIANO',
    ]);
  });

  it('devuelve vacío si la temporada no trae personajes', () => {
    expect(personajesDelDia(temporada({}), '1999-03-07')).toEqual([]);
  });
});
