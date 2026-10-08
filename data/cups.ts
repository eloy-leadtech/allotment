/**
 * National-cup registry: which domestic knockout cup each catalogue country
 * plays (Copa del Rey, Coppa Italia, FA Cup…). The mechanics are identical
 * across countries (SPEC §3, E10) — only the NAME differs — so the registry is
 * pure data (`catalog/cups.json`) and the agnostic knockout engine does the rest.
 *
 * Every country gets a cup: a country without an explicit entry falls back to a
 * generic "Copa Nacional", so all 692 catalogue leagues are playable with their
 * own cup instead of none.
 */
import cupsData from './catalog/cups.json';
import { NationalCupCatalogSchema, type NationalCup } from './schemas';

const CUPS: readonly NationalCup[] = NationalCupCatalogSchema.parse(cupsData);

const BY_COUNTRY = new Map(CUPS.map((c) => [c.country, c]));

/** Every registered national cup, in file order. */
export function nationalCups(): readonly NationalCup[] {
  return CUPS;
}

/**
 * The national cup for a catalogue country code (e.g. "ITA" → Coppa Italia).
 * Falls back to a generic cup for a country not in the registry, so every
 * league has a playable cup.
 */
export function nationalCupFor(country: string): NationalCup {
  const hit = BY_COUNTRY.get(country);
  if (hit) return hit;
  return { country, id: `${country.toLowerCase()}-cup`, nombre: 'Copa Nacional' };
}
