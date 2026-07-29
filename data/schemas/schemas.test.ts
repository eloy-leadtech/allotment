import { describe, it, expect } from 'vitest';
import { PlayerSchema, type Player } from './player';
import { TeamSchema } from './team';
import { CompetitionSchema } from './competition';
import { LeagueSchema } from './league';

const validPlayer: Player = {
  id: 'ronaldo-1976-barcelona',
  nombre: 'Ronaldo',
  nombreCompleto: 'RONALDO Luís Nazário de Lima',
  posicion: 'DEL',
  esPortero: false,
  demarcaciones: [16],
  atributos: {
    calidad: 98,
    agresividad: 93,
    resistencia: 92,
    velocidad: 97,
    fisico: 96,
    remate: 99,
    ofensivo: 96,
    pase: 97,
    entrada: 40,
    porteria: 25,
  },
  media: 90,
  dorsal: 9,
  fechaNacimiento: '1976-09-18',
  alturaCm: 183,
  pesoKg: 82,
  nacionalidad: 'BRA',
  clubAnterior: 'PSV (96)',
};

describe('PlayerSchema', () => {
  it('accepts a valid player', () => {
    expect(PlayerSchema.parse(validPlayer)).toEqual(validPlayer);
  });

  it('allows nullable calidad (reduced variant)', () => {
    expect(() => PlayerSchema.parse({ ...validPlayer, atributos: { ...validPlayer.atributos, calidad: null } })).not.toThrow();
  });

  it('rejects an out-of-range attribute', () => {
    expect(() => PlayerSchema.parse({ ...validPlayer, atributos: { ...validPlayer.atributos, remate: 150 } })).toThrow();
  });

  it('rejects an illegal position', () => {
    expect(() => PlayerSchema.parse({ ...validPlayer, posicion: 'STRIKER' })).toThrow();
  });
});

describe('TeamSchema', () => {
  it('rejects a team with no players', () => {
    expect(() => TeamSchema.parse({ id: 'bar', nombre: 'Barcelona', jugadores: [] })).toThrow();
  });
});

describe('CompetitionSchema', () => {
  it('accepts a league competition', () => {
    expect(() =>
      CompetitionSchema.parse({ kind: 'league', rounds: 2, relegationSpots: 4, pointsForWin: 3 }),
    ).not.toThrow();
  });

  it('rejects an unknown competition kind', () => {
    expect(() => CompetitionSchema.parse({ kind: 'battle-royale' })).toThrow();
  });
});

describe('LeagueSchema', () => {
  it('accepts a minimal league', () => {
    const league = {
      id: 'es-primera-9697',
      nombre: 'Primera División',
      pais: 'España',
      temporada: '96/97',
      competicion: { kind: 'league', rounds: 2, relegationSpots: 4, pointsForWin: 3 },
      equipos: [
        { id: 'bar', nombre: 'Barcelona', jugadores: [validPlayer] },
        { id: 'rma', nombre: 'Real Madrid', jugadores: [validPlayer] },
      ],
    };
    expect(() => LeagueSchema.parse(league)).not.toThrow();
  });
});
