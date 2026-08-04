import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798, loadPrimera9899 } from '@data';
import type { Attributes, Player } from '@data';
import type { Pichichi, Zamora } from '@engine';
import {
  seasonHeadlines,
  recordTransferHeadline,
  recordTransferAmount,
  hemerotecaEventIcon,
  CRACK_MEDIA,
  type SeasonHitos,
  type HemerotecaEventType,
} from './hemeroteca';
import { newCareer } from './career';
import { applyDivisionChange } from './transition';
import { buyPlayer, sellPlayer, buyableListings } from './market';
import { serializeCareer, restoreCareer } from '../save/save';
import type { CareerState } from './types';
import type { CopaResult } from '../tournament/copa';

const HUMAN = 'barcelona';

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
    dorsal: null,
    fechaNacimiento: over.fechaNacimiento ?? null,
    alturaCm: null,
    pesoKg: null,
    nacionalidad: null,
    clubAnterior: null,
  };
}

const copaWonBy = (id: string): CopaResult => ({ knockout: [], championId: id });

/** A base finished-season hito set (nothing notable) that tests override. */
function baseHitos(over: Partial<SeasonHitos> = {}): SeasonHitos {
  return {
    seasonNumber: 3,
    temporada: '98/99',
    humanTeamId: HUMAN,
    teamName: 'F.C. Barcelona',
    titles: [],
    outcome: 'stays',
    evaluation: { satisfaction: 'normal', dismissed: false, shortfall: 0 },
    dismissed: false,
    retirees: [],
    ...over,
  };
}

const pichichiFor = (teamId: string): Pichichi => ({
  playerId: 'r9',
  playerName: 'Ronaldo',
  teamId,
  goals: 30,
});

const zamoraFor = (teamId: string): Zamora => ({
  playerId: 'gk1',
  playerName: 'Zubizarreta',
  teamId,
  goalsConceded: 18,
  matches: 38,
});

const types = (events: { type: HemerotecaEventType }[]): HemerotecaEventType[] =>
  events.map((e) => e.type);

describe('seasonHeadlines — registration of each hito', () => {
  it('records nothing for an unremarkable season', () => {
    expect(seasonHeadlines(baseHitos())).toEqual([]);
  });

  it('stamps every headline with the finished season and label', () => {
    const events = seasonHeadlines(baseHitos({ outcome: 'promoted' }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ seasonNumber: 3, temporada: '98/99', type: 'ascenso' });
  });

  it('records a league title as a headline', () => {
    const events = seasonHeadlines(
      baseHitos({
        titles: [{ competition: 'liga', division: 'primera', seasonNumber: 3, temporada: '98/99' }],
      }),
    );
    expect(types(events)).toEqual(['titulo']);
    expect(events[0]!.text).toContain('CAMPEONES');
    expect(events[0]!.text).toContain('Primera');
  });

  it('records a cup title (Copa del Rey) as its own headline', () => {
    const events = seasonHeadlines(
      baseHitos({ titles: [{ competition: 'copa', seasonNumber: 3, temporada: '98/99' }] }),
    );
    expect(types(events)).toEqual(['titulo']);
    expect(events[0]!.text).toContain('COPA DEL REY');
  });

  it('records promotion and relegation from the outcome', () => {
    expect(types(seasonHeadlines(baseHitos({ outcome: 'promoted' })))).toEqual(['ascenso']);
    expect(types(seasonHeadlines(baseHitos({ outcome: 'relegated' })))).toEqual(['descenso']);
  });

  it('records the Pichichi/Zamora ONLY when they are your players', () => {
    const mine = seasonHeadlines(
      baseHitos({ pichichi: pichichiFor(HUMAN), zamora: zamoraFor(HUMAN) }),
    );
    expect(types(mine)).toEqual(['pichichi', 'zamora']);
    expect(mine[0]!.text).toContain('Ronaldo');

    const theirs = seasonHeadlines(
      baseHitos({ pichichi: pichichiFor('real-madrid'), zamora: zamoraFor('real-madrid') }),
    );
    expect(theirs).toEqual([]);
  });

  it('headlines only CRACK retirements, best first, never squad fillers', () => {
    const crack = makePlayer({ id: 'legend', nombre: 'Guardiola', media: CRACK_MEDIA + 10 });
    const star = makePlayer({ id: 'star', nombre: 'Bakero', media: CRACK_MEDIA + 3 });
    const filler = makePlayer({ id: 'filler', nombre: 'Suplente', media: CRACK_MEDIA - 5 });
    const events = seasonHeadlines(baseHitos({ retirees: [star, filler, crack] }));
    expect(types(events)).toEqual(['retirada', 'retirada']);
    // Best first: Guardiola (higher media) leads Bakero; the filler never appears.
    expect(events[0]!.text).toContain('Guardiola');
    expect(events[1]!.text).toContain('Bakero');
    expect(events.some((e) => e.text.includes('Suplente'))).toBe(false);
  });

  it('board verdict: a happy board reports a met objective', () => {
    const events = seasonHeadlines(
      baseHitos({ evaluation: { satisfaction: 'contento', dismissed: false, shortfall: -2 } }),
    );
    expect(types(events)).toEqual(['objetivo']);
    expect(events[0]!.text).toContain('cumplido');
  });

  it('board verdict: an angry board that keeps you gives a vote of confidence', () => {
    const events = seasonHeadlines(
      baseHitos({ evaluation: { satisfaction: 'enfadado', dismissed: false, shortfall: 6 } }),
    );
    expect(types(events)).toEqual(['objetivo', 'confianza']);
    expect(events[0]!.text).toContain('incumplido');
  });

  it('board verdict: a sacking headline (and no vote of confidence)', () => {
    const events = seasonHeadlines(
      baseHitos({
        dismissed: true,
        evaluation: { satisfaction: 'enfadado', dismissed: true, shortfall: 8 },
      }),
    );
    expect(types(events)).toEqual(['objetivo', 'cese']);
    expect(events.some((e) => e.type === 'confianza')).toBe(false);
  });

  it('orders a full season: titles, then ascenso, then trofeos, then retiradas, then directiva', () => {
    const crack = makePlayer({ id: 'legend', nombre: 'Guardiola', media: 88 });
    const events = seasonHeadlines(
      baseHitos({
        titles: [{ competition: 'liga', division: 'primera', seasonNumber: 3, temporada: '98/99' }],
        outcome: 'promoted',
        pichichi: pichichiFor(HUMAN),
        retirees: [crack],
        evaluation: { satisfaction: 'contento', dismissed: false, shortfall: -1 },
      }),
    );
    expect(types(events)).toEqual(['titulo', 'ascenso', 'pichichi', 'retirada', 'objetivo']);
  });
});

describe('record transfers', () => {
  it('reads the standing record per direction from the archive', () => {
    const hemeroteca = recordTransferHeadline(undefined, {
      kind: 'compra',
      seasonNumber: 1,
      temporada: '96/97',
      teamName: 'Barça',
      playerName: 'Ronaldo',
      amount: 5_000_000,
    })!;
    expect(recordTransferAmount(hemeroteca, 'compra')).toBe(5_000_000);
    expect(recordTransferAmount(hemeroteca, 'venta')).toBe(0);
  });

  it('appends only when a fee BEATS the standing record (per direction)', () => {
    let h = recordTransferHeadline(undefined, {
      kind: 'compra',
      seasonNumber: 1,
      temporada: '96/97',
      teamName: 'Barça',
      playerName: 'Ronaldo',
      amount: 5_000_000,
    });
    // A cheaper buy does NOT beat the record: same archive back.
    const same = recordTransferHeadline(h, {
      kind: 'compra',
      seasonNumber: 1,
      temporada: '96/97',
      teamName: 'Barça',
      playerName: 'Nadie',
      amount: 3_000_000,
    });
    expect(same).toBe(h);
    // A pricier buy sets a new record.
    h = recordTransferHeadline(h, {
      kind: 'compra',
      seasonNumber: 2,
      temporada: '97/98',
      teamName: 'Barça',
      playerName: 'Rivaldo',
      amount: 8_000_000,
    });
    expect(recordTransferAmount(h, 'compra')).toBe(8_000_000);
    // Sales are tracked independently from purchases.
    h = recordTransferHeadline(h, {
      kind: 'venta',
      seasonNumber: 2,
      temporada: '97/98',
      teamName: 'Barça',
      playerName: 'Figo',
      amount: 6_000_000,
    });
    expect(recordTransferAmount(h, 'venta')).toBe(6_000_000);
    expect((h ?? []).filter((e) => e.type === 'fichaje')).toHaveLength(2);
    expect((h ?? []).filter((e) => e.type === 'traspaso')).toHaveLength(1);
  });

  it('gives every headline type an icon', () => {
    const all: HemerotecaEventType[] = [
      'titulo',
      'ascenso',
      'descenso',
      'pichichi',
      'zamora',
      'retirada',
      'fichaje',
      'traspaso',
      'objetivo',
      'cese',
      'confianza',
    ];
    for (const t of all) expect(hemerotecaEventIcon(t).length).toBeGreaterThan(0);
  });
});

describe('wiring: hitos are archived when they occur', () => {
  it('records a title at the season transition (Copa del Rey won)', () => {
    const base = newCareer(loadPrimera9697(), HUMAN, 2024);
    const career = { ...base, copa: copaWonBy(HUMAN) };
    const after = applyDivisionChange(career, 'primera', loadPrimera9798());
    const titulos = (after.hemeroteca ?? []).filter((e) => e.type === 'titulo');
    expect(titulos).toHaveLength(1);
    expect(titulos[0]!.text).toContain('COPA DEL REY');
    expect(titulos[0]!.temporada).toBe('96/97');
  });

  it('records a crack retirement at the season transition', () => {
    const base = newCareer(loadPrimera9697(), HUMAN, 2024);
    // Inject a 40-year-old legend into the human squad: he retires at the transition.
    const legend = makePlayer({
      id: 'leyenda',
      nombre: 'Leyenda',
      nombreCompleto: 'La Leyenda',
      media: 88,
      fechaNacimiento: '1957-01-01',
    });
    const career = {
      ...base,
      teams: base.teams.map((t) =>
        t.id === HUMAN ? { ...t, players: [...t.players, legend] } : t,
      ),
    };
    const after = applyDivisionChange(career, 'primera', loadPrimera9798());
    expect(
      (after.hemeroteca ?? []).some((e) => e.type === 'retirada' && e.text.includes('Leyenda')),
    ).toBe(true);
  });

  it('records a record signing the moment it closes, and only when beaten', () => {
    const career = { ...newCareer(loadPrimera9697(), HUMAN, 7), budget: 5_000_000_000 };
    // buyableListings is sorted most-valuable first, so [0] sets the record and the
    // cheapest survivor cannot beat it.
    const priciest = buyableListings(career)[0]!;
    const first = buyPlayer(career, priciest.player.id);
    expect(first.ok).toBe(true);
    const fichajes1 = (first.career.hemeroteca ?? []).filter((e) => e.type === 'fichaje');
    expect(fichajes1).toHaveLength(1);
    expect(fichajes1[0]!.amount).toBe(priciest.askingPrice);

    const cheapest = buyableListings(first.career).at(-1)!;
    const second = buyPlayer(first.career, cheapest.player.id);
    expect((second.career.hemeroteca ?? []).filter((e) => e.type === 'fichaje')).toHaveLength(1);
  });

  it('records a record sale the moment it closes', () => {
    const career = newCareer(loadPrimera9697(), HUMAN, 7);
    const mine = career.teams.find((t) => t.id === HUMAN)!.players[0]!;
    const sold = sellPlayer(career, mine.id, 'real-madrid', 25_000_000);
    expect(sold.ok).toBe(true);
    const traspasos = (sold.career.hemeroteca ?? []).filter((e) => e.type === 'traspaso');
    expect(traspasos).toHaveLength(1);
    expect(traspasos[0]!.amount).toBe(25_000_000);
  });
});

describe('chronology and persistence', () => {
  it('keeps the archive in chronological (non-decreasing season) order across seasons', () => {
    let career: CareerState = {
      ...newCareer(loadPrimera9697(), HUMAN, 7),
      budget: 5_000_000_000,
      copa: copaWonBy(HUMAN),
    };
    // Season 1: a record signing, then the transition archives season-1 hitos.
    const buy = buyPlayer(career, buyableListings(career)[0]!.player.id);
    if (buy.ok) career = { ...buy.career, copa: copaWonBy(HUMAN) };
    career = applyDivisionChange(career, 'primera', loadPrimera9798());
    // Season 2: another transition archives season-2 hitos.
    career = applyDivisionChange({ ...career, copa: copaWonBy(HUMAN) }, 'primera', loadPrimera9899());

    const seasons = (career.hemeroteca ?? []).map((e) => e.seasonNumber);
    expect(seasons.length).toBeGreaterThan(1);
    for (let i = 1; i < seasons.length; i += 1) {
      expect(seasons[i]!).toBeGreaterThanOrEqual(seasons[i - 1]!);
    }
    // Both seasons produced a Copa headline.
    expect((career.hemeroteca ?? []).filter((e) => e.type === 'titulo').length).toBeGreaterThanOrEqual(2);
  });

  it('survives a save/load round-trip unchanged', () => {
    const base = { ...newCareer(loadPrimera9697(), HUMAN, 7), copa: copaWonBy(HUMAN) };
    const career = applyDivisionChange(base, 'primera', loadPrimera9798());
    expect((career.hemeroteca ?? []).length).toBeGreaterThan(0);

    const restored = restoreCareer(serializeCareer(career), loadPrimera9798());
    expect(restored.hemeroteca).toEqual(career.hemeroteca);
  });
});
