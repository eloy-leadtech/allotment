import { describe, it, expect } from 'vitest';
import {
  applyConfianza,
  directivaEnAviso,
  confianzaProvocaCese,
  DEFAULT_CONFIANZA,
  CONFIANZA_WARNING,
  CONFIANZA_SACK,
  type ConfianzaInput,
} from './confianza';

/** A neutral verdict: met the target exactly, stayed up, no title. */
const NEUTRAL: ConfianzaInput = {
  satisfaction: 'normal',
  shortfall: 0,
  outcome: 'stays',
  championLeague: false,
};

describe('applyConfianza', () => {
  it('lifts both meters when the board is happy and the target was beaten', () => {
    const next = applyConfianza(DEFAULT_CONFIANZA, {
      satisfaction: 'contento',
      shortfall: -3,
      outcome: 'stays',
      championLeague: false,
    });
    expect(next.directiva).toBeGreaterThan(DEFAULT_CONFIANZA.directiva);
    expect(next.aficion).toBeGreaterThan(DEFAULT_CONFIANZA.aficion);
  });

  it('drops both meters when the board is angry and the target was missed', () => {
    const next = applyConfianza(DEFAULT_CONFIANZA, {
      satisfaction: 'enfadado',
      shortfall: 5,
      outcome: 'stays',
      championLeague: false,
    });
    expect(next.directiva).toBeLessThan(DEFAULT_CONFIANZA.directiva);
    expect(next.aficion).toBeLessThan(DEFAULT_CONFIANZA.aficion);
  });

  it('is deterministic: same inputs always yield the same meters', () => {
    const a = applyConfianza(DEFAULT_CONFIANZA, NEUTRAL);
    const b = applyConfianza(DEFAULT_CONFIANZA, NEUTRAL);
    expect(a).toEqual(b);
  });

  it('clamps to the 0-100 range at both ends', () => {
    const floor = applyConfianza(
      { directiva: 2, aficion: 2 },
      { satisfaction: 'enfadado', shortfall: 10, outcome: 'relegated', championLeague: false },
    );
    expect(floor.directiva).toBe(0);
    expect(floor.aficion).toBe(0);

    const ceiling = applyConfianza(
      { directiva: 98, aficion: 98 },
      { satisfaction: 'contento', shortfall: -6, outcome: 'promoted', championLeague: true },
    );
    expect(ceiling.directiva).toBe(100);
    expect(ceiling.aficion).toBe(100);
  });

  it('rewards a league title and an ascenso with a big afición lift', () => {
    const title = applyConfianza(DEFAULT_CONFIANZA, {
      satisfaction: 'contento',
      shortfall: 0,
      outcome: 'promoted',
      championLeague: true,
    });
    // The afición reacts harder than the board to spectacle.
    const boardGain = title.directiva - DEFAULT_CONFIANZA.directiva;
    const crowdGain = title.aficion - DEFAULT_CONFIANZA.aficion;
    expect(crowdGain).toBeGreaterThan(boardGain);
  });

  it('a single bad-but-tolerated season from neutral does not sack the manager', () => {
    // The worst non-relegation, non-hard-dismiss verdict (enfadado, shortfall < 8).
    const next = applyConfianza(DEFAULT_CONFIANZA, {
      satisfaction: 'enfadado',
      shortfall: 7,
      outcome: 'stays',
      championLeague: false,
    });
    expect(confianzaProvocaCese(next)).toBe(false);
  });

  it('even the WORST single non-relegation season from 50 stays above the sack line', () => {
    // Recalibration goal: one missed objective, no matter how big the shortfall,
    // must not drop the directiva below the cese threshold — it is an aviso.
    const worst = applyConfianza(DEFAULT_CONFIANZA, {
      satisfaction: 'enfadado',
      shortfall: 30, // far beyond the penalty cap
      outcome: 'stays',
      championLeague: false,
    });
    expect(worst.directiva).toBeGreaterThan(CONFIANZA_SACK);
    // ...but it IS a warning: the board is watching.
    expect(directivaEnAviso(worst)).toBe(true);
  });

  it('two straight bad seasons collapse the directiva meter to the sack line', () => {
    const bad: ConfianzaInput = {
      satisfaction: 'enfadado',
      shortfall: 7,
      outcome: 'stays',
      championLeague: false,
    };
    const afterOne = applyConfianza(DEFAULT_CONFIANZA, bad);
    const afterTwo = applyConfianza(afterOne, bad);
    expect(confianzaProvocaCese(afterTwo)).toBe(true);
  });
});

describe('confianza thresholds', () => {
  it('flags the warning band above the sack line but at/below the warning line', () => {
    expect(directivaEnAviso({ directiva: CONFIANZA_WARNING, aficion: 50 })).toBe(true);
    expect(directivaEnAviso({ directiva: CONFIANZA_SACK + 1, aficion: 50 })).toBe(true);
    expect(directivaEnAviso({ directiva: CONFIANZA_WARNING + 1, aficion: 50 })).toBe(false);
    // At the sack line it is no longer a mere warning, it is a cese.
    expect(directivaEnAviso({ directiva: CONFIANZA_SACK, aficion: 50 })).toBe(false);
  });

  it('provokes a cese only at or below the sack line', () => {
    expect(confianzaProvocaCese({ directiva: CONFIANZA_SACK, aficion: 50 })).toBe(true);
    expect(confianzaProvocaCese({ directiva: CONFIANZA_SACK - 1, aficion: 0 })).toBe(true);
    expect(confianzaProvocaCese({ directiva: CONFIANZA_SACK + 1, aficion: 0 })).toBe(false);
  });

  it('the afición meter never triggers a cese on its own', () => {
    expect(confianzaProvocaCese({ directiva: 80, aficion: 0 })).toBe(false);
  });
});
