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
