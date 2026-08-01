import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadSegunda9697 } from '@data';
import { newCareer } from './career';
import { seasonIncome } from './finances';
import {
  DEFAULT_STADIUM,
  MAX_STADIUM_LEVEL,
  STADIUM_TIERS,
  stadiumAforo,
  gateMultiplier,
  canExpand,
  nextExpansionCost,
  nextExpansionAforo,
  expandStadium,
} from './stadium';
import type { CareerState } from './types';

const primera = loadPrimera9697();

/** A fresh Primera career for the given human club. */
function career(teamId = 'barcelona', seed = 7): CareerState {
  return newCareer(primera, teamId, seed);
}

describe('stadium ladder', () => {
  it('a fresh career starts at the base ground (level 0)', () => {
    expect(career().stadium).toEqual(DEFAULT_STADIUM);
    expect(DEFAULT_STADIUM.capacityLevel).toBe(0);
  });

  it('gate multiplier is exactly 1.0 at the base level and grows with the aforo', () => {
    expect(gateMultiplier({ capacityLevel: 0 })).toBe(1);
    for (let lvl = 1; lvl <= MAX_STADIUM_LEVEL; lvl += 1) {
      expect(gateMultiplier({ capacityLevel: lvl })).toBeGreaterThan(
        gateMultiplier({ capacityLevel: lvl - 1 }),
      );
    }
  });

  it('aforo strictly increases up the ladder and matches the tier table', () => {
    for (let lvl = 0; lvl <= MAX_STADIUM_LEVEL; lvl += 1) {
      expect(stadiumAforo({ capacityLevel: lvl })).toBe(STADIUM_TIERS[lvl]!.aforo);
      if (lvl > 0) {
        expect(stadiumAforo({ capacityLevel: lvl })).toBeGreaterThan(
          stadiumAforo({ capacityLevel: lvl - 1 }),
        );
      }
    }
  });

  it('tolerates missing/out-of-range levels by clamping into the ladder', () => {
    expect(stadiumAforo(undefined)).toBe(STADIUM_TIERS[0]!.aforo);
    expect(stadiumAforo({ capacityLevel: -5 })).toBe(STADIUM_TIERS[0]!.aforo);
    expect(stadiumAforo({ capacityLevel: 99 })).toBe(STADIUM_TIERS[MAX_STADIUM_LEVEL]!.aforo);
    expect(gateMultiplier(undefined)).toBe(1);
  });

  it('reports the next expansion cost/aforo until the top tier', () => {
    expect(canExpand({ capacityLevel: 0 })).toBe(true);
    expect(nextExpansionCost({ capacityLevel: 0 })).toBe(STADIUM_TIERS[1]!.upgradeCost);
    expect(nextExpansionAforo({ capacityLevel: 0 })).toBe(STADIUM_TIERS[1]!.aforo);

    expect(canExpand({ capacityLevel: MAX_STADIUM_LEVEL })).toBe(false);
    expect(nextExpansionCost({ capacityLevel: MAX_STADIUM_LEVEL })).toBeNull();
    expect(nextExpansionAforo({ capacityLevel: MAX_STADIUM_LEVEL })).toBeNull();
  });
});

describe('expandStadium', () => {
  it('debits the cost and bumps the level when affordable', () => {
    const cost = nextExpansionCost(DEFAULT_STADIUM)!;
    const c = { ...career(), budget: cost + 1_000_000 };
    const result = expandStadium(c);
    expect(result.ok).toBe(true);
    expect(result.career.stadium.capacityLevel).toBe(1);
    expect(result.career.budget).toBe(1_000_000);
  });

  it('soft-fails with no budget and leaves the career untouched', () => {
    const cost = nextExpansionCost(DEFAULT_STADIUM)!;
    const c = { ...career(), budget: cost - 1 };
    const result = expandStadium(c);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('presupuesto');
    expect(result.career).toBe(c);
  });

  it('soft-fails at the top tier', () => {
    const c = { ...career(), budget: 999_999_999, stadium: { capacityLevel: MAX_STADIUM_LEVEL } };
    const result = expandStadium(c);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('maximo');
  });

  it('never touches the squad or the in-progress season', () => {
    const c = { ...career(), budget: 999_999_999 };
    const result = expandStadium(c);
    expect(result.ok).toBe(true);
    expect(result.career.teams).toBe(c.teams);
    expect(result.career.season).toBe(c.season);
  });

  it('is deterministic: same career expands identically', () => {
    const c = { ...career(), budget: 999_999_999 };
    expect(expandStadium(c).career.stadium).toEqual(expandStadium(c).career.stadium);
  });
});

describe('stadium drives the gate income', () => {
  it('a bigger aforo yields a strictly bigger gate every season', () => {
    const base = career();
    const baseGate = seasonIncome(base).gate;
    const built = { ...base, stadium: { capacityLevel: MAX_STADIUM_LEVEL } };
    const builtGate = seasonIncome(built).gate;
    expect(builtGate).toBeGreaterThan(baseGate);
    // Gate scales by the aforo ratio (multiplier), not by anything else.
    expect(builtGate).toBe(Math.round(baseGate * gateMultiplier(built.stadium)));
  });

  it('the base ground leaves the classic flat gate unchanged (Primera 12M)', () => {
    expect(seasonIncome(career()).gate).toBe(12_000_000);
  });

  it('applies to Segunda too', () => {
    const seg = { ...newCareer(loadSegunda9697(), 'leganes', 3), division: 'segunda' as const };
    expect(seasonIncome(seg).gate).toBe(3_000_000);
    const built = { ...seg, stadium: { capacityLevel: 2 } };
    expect(seasonIncome(built).gate).toBe(Math.round(3_000_000 * gateMultiplier(built.stadium)));
  });
});
