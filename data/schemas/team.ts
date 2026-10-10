import { z } from 'zod';
import { PlayerSchema } from './player';

export const TeamColorsSchema = z.object({
  primario: z.string(),
  secundario: z.string(),
});

export const TeamSchema = z.object({
  id: z.string().min(1),
  /** Short display name for tables/lists, e.g. "Betis". */
  nombre: z.string().min(1),
  /** Full official club name, e.g. "Real Betis Balompié". Optional; falls back to `nombre`. */
  nombreCompleto: z.string().min(1).optional(),
  colores: TeamColorsSchema.optional(),
  jugadores: z.array(PlayerSchema).min(1),
});
export type Team = z.infer<typeof TeamSchema>;
export type TeamColors = z.infer<typeof TeamColorsSchema>;
