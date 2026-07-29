import { z } from 'zod';
import { TeamSchema } from './team';
import { CompetitionSchema } from './competition';

/** A single competition instance for one season (e.g. Liga española 96/97). */
export const LeagueSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  pais: z.string().min(1),
  /** Season label, e.g. "96/97". */
  temporada: z.string().min(1),
  competicion: CompetitionSchema,
  equipos: z.array(TeamSchema).min(2),
});
export type League = z.infer<typeof LeagueSchema>;

/** Persisted game state. Season progression detail is added with game/season. */
export const SaveGameSchema = z.object({
  version: z.number().int(),
  /** League-level seed; every match derives its own seed from it. */
  seed: z.number().int(),
  clubJugadorId: z.string().min(1),
  temporada: z.string().min(1),
});
export type SaveGame = z.infer<typeof SaveGameSchema>;
