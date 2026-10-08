import { z } from 'zod';

/**
 * Competition format, modelled as a discriminated union so the agnostic engine
 * can host leagues, cups and tournaments from data alone (SPEC §4.3). Only the
 * league variant is implemented for now; cup/tournament arrive with the copas.
 */
export const CompetitionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('league'),
    /** Round-robin passes; 2 = home & away (doble vuelta). */
    rounds: z.literal(2),
    /** How many bottom teams are relegated. */
    relegationSpots: z.number().int().min(0),
    /** Points awarded for a win: 3 from 1995/96 on, 2 before. */
    pointsForWin: z.union([z.literal(2), z.literal(3)]),
  }),
]);
export type Competition = z.infer<typeof CompetitionSchema>;

/**
 * A country's domestic knockout cup (Copa del Rey, Coppa Italia, FA Cup…),
 * played alongside its league with the agnostic knockout engine (SPEC §3, E10).
 * Only the NAME differs per country; the mechanics are identical, so this is the
 * data the registry needs to give every catalogue country its own cup.
 */
export const NationalCupSchema = z.object({
  /** ISO-3166 alpha-3 country code, matching the catalogue's `country`. */
  country: z.string().min(1),
  /** Stable slug for the cup (e.g. "coppa-italia"). */
  id: z.string().min(1),
  /** Display name in Spanish/original (e.g. "Coppa Italia"). */
  nombre: z.string().min(1),
});
export type NationalCup = z.infer<typeof NationalCupSchema>;

/** The whole country→cup registry, loaded from `data/catalog/cups.json`. */
export const NationalCupCatalogSchema = z.array(NationalCupSchema);
