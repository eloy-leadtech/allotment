import { z } from 'zod';

/** A player rating on the classic PC Fútbol 0-99 scale. */
const rating = z.number().int().min(0).max(99);

/**
 * The 10 gameplay attributes reverse-engineered from PC Fútbol 5.0.
 * `calidad` is nullable because the "reduced" record variant (lightweight packs)
 * stored only 9 attributes without it.
 */
export const AttributesSchema = z.object({
  calidad: rating.nullable(),
  agresividad: rating,
  resistencia: rating,
  velocidad: rating,
  fisico: rating,
  remate: rating,
  ofensivo: rating,
  pase: rating,
  entrada: rating,
  porteria: rating,
});
export type Attributes = z.infer<typeof AttributesSchema>;

/** Coarse pitch line, derived at ingest time. */
export const PositionSchema = z.enum(['POR', 'DEF', 'MED', 'DEL']);
export type Position = z.infer<typeof PositionSchema>;

export const PlayerSchema = z.object({
  /** Synthetic stable id: hash(nombreCompleto + fechaNacimiento + equipo). */
  id: z.string().min(1),
  nombre: z.string().min(1),
  nombreCompleto: z.string().min(1),
  posicion: PositionSchema,
  esPortero: z.boolean(),
  /** Raw demarcation codes from the source (0-17); not yet mapped to names. */
  demarcaciones: z.array(z.number().int()),
  atributos: AttributesSchema,
  /** Potential ceiling per attribute. Absent for now; drives youth growth later. */
  potencial: AttributesSchema.optional(),
  media: rating,
  dorsal: z.number().int().min(1).max(99).nullable(),
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  fechaNacimiento: z.string().nullable(),
  alturaCm: z.number().int().nullable(),
  pesoKg: z.number().int().nullable(),
  nacionalidad: z.string().nullable(),
  clubAnterior: z.string().nullable(),
});
export type Player = z.infer<typeof PlayerSchema>;
