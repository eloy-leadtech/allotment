import { describe, it, expect } from 'vitest';
import type { Attributes, League, Player, Team } from '@data';
import { newCareer } from './career';
import {
  internationalListings,
  buyInternational,
  squadSize,
  MAX_SQUAD,
  type ForeignClub,
} from './internationalMarket';
import { askingPrice, releaseClause } from './market';
import { playerAge, seasonStartYear } from './development';

// --- Synthetic data factory (pure, deterministic) --------------------------

function attrs(media: number): Attributes {
  return {
    calidad: media,
    agresividad: media,
    resistencia: media,
    velocidad: media,
    fisico: media,
    remate: media,
    ofensivo: media,
    pase: media,
    entrada: media,
    porteria: media,
  };
}

function player(id: string, media: number, posicion: Player['posicion'] = 'MED'): Player {
  return {
    id,
    nombre: id,
    nombreCompleto: `Player ${id}`,
    posicion,
    esPortero: posicion === 'POR',
    demarcaciones: [],
    atributos: attrs(media),
    media,
    dorsal: null,
    fechaNacimiento: '1996-01-01',
    alturaCm: null,
    pesoKg: null,
    nacionalidad: null,
    clubAnterior: null,
  };
}

function team(id: string, nombre: string, media: number): Team {
  const players: Player[] = [player(`${id}-gk`, media, 'POR')];
  for (let i = 0; i < 15; i += 1) {
    const pos: Player['posicion'] = i < 5 ? 'DEF' : i < 11 ? 'MED' : 'DEL';
    players.push(player(`${id}-p${i}`, media, pos));
  }
  return { id, nombre, jugadores: players };
}

function league(id: string, pais: string, temporada: string, teams: Team[]): League {
  return {
    id,
    nombre: `Liga ${pais}`,
    pais,
    temporada,
    competicion: { kind: 'league', rounds: 2, relegationSpots: 3, pointsForWin: 3 },
    equipos: teams,
  };
}

/** A small English pool of foreign clubs (not in the human's league). */
function englishPool(): ForeignClub[] {
  return [
    { id: 'eng-arsenal', nombre: 'Arsenal', country: 'ENG', leagueId: 'eng-1-2020-21', players: team('arsenal', 'Arsenal', 80).jugadores },
    { id: 'eng-chelsea', nombre: 'Chelsea', country: 'ENG', leagueId: 'eng-1-2020-21', players: team('chelsea', 'Chelsea', 72).jugadores },
  ];
}

const italianLeague = league('ita-1-2020-21', 'Italia', '20/21', [
  team('juventus', 'Juventus', 78),
  team('milan', 'Milan', 74),
  team('inter', 'Inter', 76),
  team('roma', 'Roma', 70),
]);

describe('internationalListings', () => {
  const career = newCareer(italianLeague, 'juventus', 2024);
  const pool = englishPool();

  it('lists every foreign player, most valuable first', () => {
    const listings = internationalListings(career, pool);
    const totalForeign = pool.reduce((n, c) => n + c.players.length, 0);
    expect(listings).toHaveLength(totalForeign);
    for (let i = 1; i < listings.length; i += 1) {
      expect(listings[i - 1]!.value).toBeGreaterThanOrEqual(listings[i]!.value);
    }
    // Every listing carries its foreign origin.
    expect(listings.every((l) => l.country === 'ENG' && l.leagueId === 'eng-1-2020-21')).toBe(true);
  });

  it('prices with the domestic curve (asking < clause)', () => {
    const listings = internationalListings(career, pool);
    for (const l of listings) {
      expect(l.askingPrice).toBeGreaterThan(l.value);
      expect(l.clause).toBeGreaterThan(l.askingPrice);
    }
  });
});

describe('buyInternational', () => {
  const pool = englishPool();
  const target = pool[0]!.players[0]!; // Arsenal goalkeeper (media 80)

  it('signs a foreign player, debiting the asking price and growing the squad', () => {
    const career = { ...newCareer(italianLeague, 'juventus', 2024), budget: 500_000_000 };
    const before = squadSize(career);
    const age = playerAge(target, seasonStartYear(career.temporada));
    const asking = askingPrice(target, age);

    const out = buyInternational(career, target.id, pool);
    expect(out.status).toBe('accepted');
    if (out.status !== 'accepted') return;
    expect(out.price).toBe(asking);
    expect(out.career.budget).toBe(career.budget - asking);
    expect(squadSize(out.career)).toBe(before + 1);
    // The new man is in the human squad with a contract.
    const human = out.career.teams.find((t) => t.id === 'juventus')!;
    const signed = human.players.find((p) => p.nombre === target.nombre)!;
    expect(signed).toBeDefined();
    expect(out.career.contracts[signed.id]).toBeDefined();
  });

  it('honours the release clause as an instant buy-out ceiling', () => {
    const career = { ...newCareer(italianLeague, 'juventus', 2024), budget: 500_000_000 };
    const age = playerAge(target, seasonStartYear(career.temporada));
    const clause = releaseClause(target, age);
    const out = buyInternational(career, target.id, pool, clause + 1);
    expect(out.status).toBe('accepted');
    if (out.status === 'accepted') expect(out.price).toBe(clause);
  });

  it('rejects an offer below the asking price', () => {
    const career = { ...newCareer(italianLeague, 'juventus', 2024), budget: 500_000_000 };
    const age = playerAge(target, seasonStartYear(career.temporada));
    const asking = askingPrice(target, age);
    const out = buyInternational(career, target.id, pool, Math.round(asking * 0.5));
    expect(out.status).toBe('rejected');
  });

  it('refuses when the budget is short', () => {
    const career = { ...newCareer(italianLeague, 'juventus', 2024), budget: 1 };
    const out = buyInternational(career, target.id, pool);
    expect(out.status).toBe('no-budget');
  });

  it('enforces the tope de plantilla (MAX_SQUAD)', () => {
    const base = newCareer(italianLeague, 'juventus', 2024);
    // Pad the human squad up to the cap.
    const padded = {
      ...base,
      budget: 500_000_000,
      teams: base.teams.map((t) =>
        t.id === 'juventus'
          ? {
              ...t,
              players: [
                ...t.players,
                ...Array.from({ length: Math.max(0, MAX_SQUAD - t.players.length) }, (_, i) =>
                  player(`filler-${i}`, 50),
                ),
              ],
            }
          : t,
      ),
    };
    expect(squadSize(padded)).toBeGreaterThanOrEqual(MAX_SQUAD);
    const out = buyInternational(padded, target.id, pool);
    expect(out.status).toBe('squad-full');
  });

  it('is deterministic and returns no-encontrado for an unknown player', () => {
    const career = { ...newCareer(italianLeague, 'juventus', 2024), budget: 500_000_000 };
    const a = buyInternational(career, target.id, pool);
    const b = buyInternational(career, target.id, pool);
    expect(a).toEqual(b);
    expect(buyInternational(career, 'nobody', pool).status).toBe('no-encontrado');
  });

  it('throws once the season is under way (market closed)', () => {
    const base = newCareer(italianLeague, 'juventus', 2024);
    const started = {
      ...base,
      season: { ...base.season, results: [{ homeId: 'a', awayId: 'b', homeGoals: 1, awayGoals: 0, events: [] }] as never },
    };
    expect(() => buyInternational(started, target.id, pool)).toThrow();
  });
});
