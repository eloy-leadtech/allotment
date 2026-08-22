import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadSegunda9697 } from '@data';
import { newCareer } from './career';
import {
  sponsorOffers,
  activeSponsorOffer,
  sponsorIncome,
  chooseSponsor,
  qualifiesForEurope,
  isSponsorId,
  DEFAULT_SPONSOR,
} from './sponsors';
import { seasonIncome } from './finances';
import { advanceMatchday, currentStandings } from '../season/season';
import type { CareerState } from './types';

/** Play a career's season to the end so standings/position are final. */
function playToEnd(career: CareerState): CareerState {
  let season = career.season;
  while (season.currentMatchday <= season.totalMatchdays) season = advanceMatchday(season).state;
  return { ...career, season };
}

describe('sponsorOffers', () => {
  it('offers the four stable tiers, basic first', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 7);
    const offers = sponsorOffers(career);
    expect(offers.map((o) => o.id)).toEqual(['basico', 'estandar', 'ambicioso', 'premium']);
    expect(offers[0]!.hasCondition).toBe(false);
  });

  it('is deterministic from seed + season + squad', () => {
    const a = newCareer(loadPrimera9697(), 'barcelona', 7);
    const b = newCareer(loadPrimera9697(), 'barcelona', 7);
    expect(sponsorOffers(a)).toEqual(sponsorOffers(b));
  });

  it('pays a bigger club more than a Segunda side', () => {
    const big = sponsorOffers(newCareer(loadPrimera9697(), 'barcelona', 7));
    const small = sponsorOffers({ ...newCareer(loadSegunda9697(), 'leganes', 7), division: 'segunda' });
    const bigEstandar = big.find((o) => o.id === 'estandar')!;
    const smallEstandar = small.find((o) => o.id === 'estandar')!;
    expect(bigEstandar.annual).toBeGreaterThan(smallEstandar.annual);
  });

  it('gives the ambicioso tier the biggest Europe bonus and premium the biggest guarantee', () => {
    const offers = sponsorOffers(newCareer(loadPrimera9697(), 'barcelona', 7));
    const byId = new Map(offers.map((o) => [o.id, o]));
    expect(byId.get('premium')!.annual).toBeGreaterThan(byId.get('estandar')!.annual);
    expect(byId.get('ambicioso')!.europeBonus).toBeGreaterThan(byId.get('premium')!.europeBonus);
    // The gamble has a lower guaranteed floor than the safe premium tier.
    expect(byId.get('ambicioso')!.annual).toBeLessThan(byId.get('premium')!.annual);
  });
});

describe('chooseSponsor', () => {
  it('records the decision on the career and nothing else', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 7);
    const next = chooseSponsor(career, 'premium');
    expect(next.sponsor).toEqual({ sponsorId: 'premium' });
    expect(next.budget).toBe(career.budget);
    expect(next.teams).toBe(career.teams);
  });

  it('ignores an unknown tier id', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 7);
    // @ts-expect-error intentionally passing an invalid id
    expect(chooseSponsor(career, 'inventado')).toBe(career);
  });

  it('defaults to the basic sponsor when none is chosen', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 7);
    expect(activeSponsorOffer({ ...career, sponsor: undefined }).id).toBe('basico');
    expect(DEFAULT_SPONSOR.sponsorId).toBe('basico');
  });
});

describe('sponsorIncome', () => {
  it('is the guaranteed annual for a no-strings tier', () => {
    const career = chooseSponsor(playToEnd(newCareer(loadPrimera9697(), 'barcelona', 7)), 'basico');
    const offer = activeSponsorOffer(career);
    expect(offer.hasCondition).toBe(false);
    expect(sponsorIncome(career)).toBe(offer.annual);
  });

  it('adds the Europe bonus only when the club finishes in a European place', () => {
    const played = playToEnd(newCareer(loadPrimera9697(), 'barcelona', 5));
    const table = currentStandings(played.season);
    const europeanId = table[0]!.teamId; // champion => Champions place
    const bottomId = table[table.length - 1]!.teamId; // last => no Europe

    const withEurope = chooseSponsor({ ...played, humanTeamId: europeanId }, 'ambicioso');
    const withoutEurope = chooseSponsor({ ...played, humanTeamId: bottomId }, 'ambicioso');
    const offer = activeSponsorOffer(withEurope);

    expect(qualifiesForEurope(withEurope)).toBe(true);
    expect(qualifiesForEurope(withoutEurope)).toBe(false);
    expect(sponsorIncome(withEurope)).toBe(offer.annual + offer.europeBonus);
    // Same tier, same season base, but no bonus without the European finish.
    expect(sponsorIncome(withoutEurope)).toBe(activeSponsorOffer(withoutEurope).annual);
    expect(sponsorIncome(withEurope)).toBeGreaterThan(sponsorIncome(withoutEurope));
  });

  it('never pays a Segunda side the Europe bonus (no continental place)', () => {
    const seg = playToEnd({ ...newCareer(loadSegunda9697(), 'leganes', 3), division: 'segunda' });
    const career = chooseSponsor(seg, 'ambicioso');
    expect(qualifiesForEurope(career)).toBe(false);
    expect(sponsorIncome(career)).toBe(activeSponsorOffer(career).annual);
  });
});

describe('seasonIncome integration', () => {
  it('folds the sponsor payment into the season total', () => {
    const played = chooseSponsor(playToEnd(newCareer(loadPrimera9697(), 'barcelona', 7)), 'premium');
    const income = seasonIncome(played);
    expect(income.sponsor).toBe(sponsorIncome(played));
    expect(income.total).toBe(
      income.tv + income.gate + income.leaguePrize + income.copa + income.europa + income.sponsor,
    );
  });

  it('a fatter sponsor tier lifts the season income', () => {
    const played = playToEnd(newCareer(loadPrimera9697(), 'barcelona', 7));
    const basic = seasonIncome(chooseSponsor(played, 'basico'));
    const premium = seasonIncome(chooseSponsor(played, 'premium'));
    expect(premium.total).toBeGreaterThan(basic.total);
  });

  it('keeps the sponsor a sane fraction of income (not economy-breaking)', () => {
    const played = chooseSponsor(playToEnd(newCareer(loadPrimera9697(), 'barcelona', 7)), 'premium');
    const income = seasonIncome(played);
    // Even the top tier stays a minority of total income.
    expect(income.sponsor).toBeLessThan(income.total * 0.5);
  });
});

describe('isSponsorId', () => {
  it('recognises the four tiers and rejects anything else', () => {
    expect(isSponsorId('basico')).toBe(true);
    expect(isSponsorId('premium')).toBe(true);
    expect(isSponsorId('otro')).toBe(false);
  });
});
