import { z } from 'zod';
import { PlayerSchema } from './player';

export const TeamColorsSchema = z.object({
  primario: z.string(),
  secundario: z.string(),
});

export const TeamSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  colores: TeamColorsSchema.optional(),
  jugadores: z.array(PlayerSchema).min(1),
});
export type Team = z.infer<typeof TeamSchema>;
export type TeamColors = z.infer<typeof TeamColorsSchema>;
