import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadSegunda9697 } from '@data';
import { newCareer } from './career';
import {
  DEFAULT_CREDIT,
  SEASON_INTEREST_RATE,
  MAX_SEASONS_OVER_LIMIT,
  creditLimit,
  creditAvailable,
  totalDebt,
  overdraft,
  isInDebt,
  requestCredit,
  liquidateSeason,
  economicDismissal,
} from './credit';
import type { CareerState } from './types';

const HUMAN = 'barcelona';
const freshBarca = (): CareerState => newCareer(loadPrimera9697(), HUMAN, 7);

describe('credit: state and limit', () => {
  it('a fresh career is debt-free', () => {
    const career = freshBarca();
    expect(career.credit).toEqual(DEFAULT_CREDIT);
    expect(isInDebt(career)).toBe(false);
    expect(totalDebt(career)).toBe(0);
  });

  it('the credit limit scales with squad strength (a big club borrows more)', () => {
    const barca = freshBarca();
    const racing = newCareer(loadPrimera9697(), 'racing', 7);
    expect(creditLimit(barca)).toBeGreaterThan(creditLimit(racing));
    expect(Number.isInteger(creditLimit(barca))).toBe(true);
  });

  it('a bigger aforo (expanded stadium) unlocks more credit', () => {
    const base = freshBarca();
    const expanded: CareerState = { ...base, stadium: { capacityLevel: 4 } };
    expect(creditLimit(expanded)).toBeGreaterThan(creditLimit(base));
  });

  it('is deterministic', () => {
    expect(creditLimit(freshBarca())).toBe(creditLimit(freshBarca()));
  });

  it('a Segunda club sits on the lower division floor', () => {
    const seg = { ...newCareer(loadSegunda9697(), 'leganes', 3), division: 'segunda' as const };
    const prim = freshBarca();
    expect(creditLimit(seg)).toBeLessThan(creditLimit(prim));
  });
});

describe('credit: overdraft and total debt', () => {
  it('overdraft is the negative part of the budget', () => {
    expect(overdraft(5_000_000)).toBe(0);
    expect(overdraft(-5_000_000)).toBe(5_000_000);
  });

  it('total debt combines an outstanding loan and an overdrawn treasury', () => {
    const career: CareerState = {
      ...freshBarca(),
      budget: -3_000_000,
      credit: { loan: 2_000_000, seasonsOverLimit: 0 },
    };
    expect(totalDebt(career)).toBe(5_000_000);
    expect(isInDebt(career)).toBe(true);
  });
});

describe('requestCredit', () => {
  it('advances cash into the budget and books the loan, capped at the limit', () => {
    const career = { ...freshBarca(), budget: 0 };
    const room = creditAvailable(career);
    expect(room).toBeGreaterThan(0);
    const result = requestCredit(career, room + 50_000_000); // ask for far too much
    expect(result.ok).toBe(true);
    expect(result.granted).toBe(room); // capped at what's available
    expect(result.career.budget).toBe(0 + room);
    expect(result.career.credit?.loan).toBe(room);
    expect(creditAvailable(result.career)).toBe(0);
  });

  it('advances exactly the requested amount when within the limit', () => {
    const career = { ...freshBarca(), budget: 0 };
    const result = requestCredit(career, 1_000_000);
    expect(result.ok).toBe(true);
    expect(result.granted).toBe(1_000_000);
    expect(result.career.budget).toBe(1_000_000);
    expect(result.career.credit?.loan).toBe(1_000_000);
  });

  it('soft-fails on a non-positive request, leaving the career untouched', () => {
    const career = freshBarca();
    const result = requestCredit(career, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cantidad');
    expect(result.career).toBe(career);
  });

  it('soft-fails once the credit limit is already fully drawn', () => {
    const base = freshBarca();
    const maxed: CareerState = {
      ...base,
      credit: { loan: creditLimit(base), seasonsOverLimit: 0 },
    };
    const result = requestCredit(maxed, 1_000_000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('limite');
    expect(result.granted).toBe(0);
  });
});

describe('liquidateSeason', () => {
  it('a healthy season (income > wages, no debt) ends in the black with no interest', () => {
    const liq = liquidateSeason({
      budget: 10_000_000,
      loan: 0,
      income: 30_000_000,
      wages: 20_000_000,
      creditLimit: 40_000_000,
      seasonsOverLimit: 0,
    });
    expect(liq.interest).toBe(0);
    expect(liq.budget).toBe(20_000_000);
    expect(liq.credit).toEqual({ loan: 0, seasonsOverLimit: 0 });
  });

  it('wages beyond income push the treasury into the red (no clamp)', () => {
    const liq = liquidateSeason({
      budget: 5_000_000,
      loan: 0,
      income: 10_000_000,
      wages: 30_000_000,
      creditLimit: 40_000_000,
      seasonsOverLimit: 0,
    });
    expect(liq.budget).toBe(5_000_000 + 10_000_000 - 30_000_000); // -15M
    expect(liq.budget).toBeLessThan(0);
  });

  it('charges interest on the debt carried in', () => {
    const liq = liquidateSeason({
      budget: -10_000_000,
      loan: 0,
      income: 0,
      wages: 0,
      creditLimit: 40_000_000,
      seasonsOverLimit: 0,
    });
    // Interest on 10M carried debt; budget falls by exactly that interest.
    expect(liq.interest).toBe(Math.round(10_000_000 * SEASON_INTEREST_RATE));
    expect(liq.budget).toBe(-10_000_000 - liq.interest);
  });

  it('a treasury back in the black repays the outstanding loan first', () => {
    const liq = liquidateSeason({
      budget: 0,
      loan: 8_000_000,
      income: 30_000_000,
      wages: 5_000_000,
      creditLimit: 40_000_000,
      seasonsOverLimit: 0,
    });
    // Interest on the 8M loan is charged, then the loan is repaid from the surplus.
    const interest = Math.round(8_000_000 * SEASON_INTEREST_RATE);
    expect(liq.interest).toBe(interest);
    expect(liq.credit.loan).toBe(0);
    expect(liq.budget).toBe(0 + 30_000_000 - 5_000_000 - interest - 8_000_000);
  });

  it('counts a season whose debt stays above the credit limit, and resets on a clean one', () => {
    const overLimit = liquidateSeason({
      budget: -60_000_000,
      loan: 0,
      income: 0,
      wages: 0,
      creditLimit: 40_000_000,
      seasonsOverLimit: 1,
    });
    expect(overLimit.credit.seasonsOverLimit).toBe(2); // still over the limit

    const recovered = liquidateSeason({
      budget: 50_000_000,
      loan: 0,
      income: 0,
      wages: 0,
      creditLimit: 40_000_000,
      seasonsOverLimit: 2,
    });
    expect(recovered.credit.seasonsOverLimit).toBe(0); // clean season resets
  });

  it('is deterministic', () => {
    const input = {
      budget: -5_000_000,
      loan: 2_000_000,
      income: 12_000_000,
      wages: 9_000_000,
      creditLimit: 20_000_000,
      seasonsOverLimit: 0,
    };
    expect(liquidateSeason(input)).toEqual(liquidateSeason(input));
  });
});

describe('economicDismissal', () => {
  it('sacks the manager after the debt sits over the limit for too many seasons', () => {
    const base = freshBarca();
    expect(economicDismissal(base)).toBe(false);
    const brink: CareerState = {
      ...base,
      credit: { loan: 0, seasonsOverLimit: MAX_SEASONS_OVER_LIMIT - 1 },
    };
    expect(economicDismissal(brink)).toBe(false);
    const sacked: CareerState = {
      ...base,
      credit: { loan: 0, seasonsOverLimit: MAX_SEASONS_OVER_LIMIT },
    };
    expect(economicDismissal(sacked)).toBe(true);
  });
});
