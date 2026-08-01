import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer } from './career';
import {
  titlesWonThisSeason,
  palmaresCompetitionLabel,
  palmaresCompetitionIcon,
} from './palmares';
import type { CareerState } from './types';
import type { CopaResult } from '../tournament/copa';
import type { EuropaResult } from './europa';

const league = loadPrimera9697();
const HUMAN = league.equipos[0]!.id;
const OTHER = league.equipos[1]!.id;

/** A base season-1 career for HUMAN, with cups overridable per test. */
function baseCareer(overrides: Partial<CareerState> = {}): CareerState {
  return { ...newCareer(league, HUMAN, 2024), ...overrides };
}

const copaWonBy = (id: string): CopaResult => ({ knockout: [], championId: id });

function europa(
  humanComp: EuropaResult['humanComp'],
  championsId: string,
  uefaId: string,
): EuropaResult {
  return {
    temporada: '96/97',
    champions: { groups: [], knockout: [], championId: championsId },
    uefa: { knockout: [], championId: uefaId },
    humanComp,
  };
}

describe('titlesWonThisSeason', () => {
  it('records nothing when the human wins nothing', () => {
    const career = baseCareer({ copa: copaWonBy(OTHER), europa: europa('champions', OTHER, OTHER) });
    expect(titlesWonThisSeason(career, OTHER)).toEqual([]);
  });

  it('records a Primera league title when the human is league champion', () => {
    const career = baseCareer();
    const titles = titlesWonThisSeason(career, HUMAN);
    expect(titles).toEqual([
      { competition: 'liga', division: 'primera', seasonNumber: 1, temporada: '96/97' },
    ]);
  });

  it('records a Segunda league title with the right division', () => {
    const career = baseCareer({ division: 'segunda' });
    const titles = titlesWonThisSeason(career, HUMAN);
    expect(titles).toEqual([
      { competition: 'liga', division: 'segunda', seasonNumber: 1, temporada: '96/97' },
    ]);
  });

  it('records the Copa del Rey when the human wins it', () => {
    const career = baseCareer({ copa: copaWonBy(HUMAN) });
    const titles = titlesWonThisSeason(career, OTHER);
    expect(titles).toEqual([{ competition: 'copa', seasonNumber: 1, temporada: '96/97' }]);
  });

  it('records the Champions only when the human played (and won) it', () => {
    const career = baseCareer({ europa: europa('champions', HUMAN, OTHER) });
    expect(titlesWonThisSeason(career, OTHER)).toEqual([
      { competition: 'champions', seasonNumber: 1, temporada: '96/97' },
    ]);
  });

  it('records the UEFA only when the human played (and won) it', () => {
    const career = baseCareer({ europa: europa('uefa', OTHER, HUMAN) });
    expect(titlesWonThisSeason(career, OTHER)).toEqual([
      { competition: 'uefa', seasonNumber: 1, temporada: '96/97' },
    ]);
  });

  it('does NOT credit a European cup the human did not play, even if its id matches', () => {
    // Human played the Champions; the UEFA champion id equals HUMAN but is an AI club's.
    const career = baseCareer({ europa: europa('champions', OTHER, HUMAN) });
    expect(titlesWonThisSeason(career, OTHER)).toEqual([]);
  });

  it('records a full treble (liga + copa + champions) in won order', () => {
    const career = baseCareer({
      copa: copaWonBy(HUMAN),
      europa: europa('champions', HUMAN, OTHER),
    });
    const titles = titlesWonThisSeason(career, HUMAN);
    expect(titles.map((t) => t.competition)).toEqual(['liga', 'copa', 'champions']);
  });

  it('ignores cups when none are attached (only the league is judged)', () => {
    const career = baseCareer();
    expect(career.copa).toBeUndefined();
    expect(titlesWonThisSeason(career, HUMAN).map((t) => t.competition)).toEqual(['liga']);
  });
});

describe('palmarés labels', () => {
  it('labels league titles by division', () => {
    expect(palmaresCompetitionLabel('liga', 'primera')).toContain('Primera');
    expect(palmaresCompetitionLabel('liga', 'segunda')).toContain('Segunda');
    expect(palmaresCompetitionLabel('copa')).toBe('Copa del Rey');
    expect(palmaresCompetitionLabel('champions')).toBe('Champions');
    expect(palmaresCompetitionLabel('uefa')).toBe('UEFA');
  });

  it('gives every competition an icon', () => {
    for (const c of ['liga', 'copa', 'champions', 'uefa'] as const) {
      expect(palmaresCompetitionIcon(c).length).toBeGreaterThan(0);
    }
  });
});
