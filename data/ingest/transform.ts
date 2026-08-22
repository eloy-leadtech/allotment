/**
 * Shared transforms from the reverse-engineered source format into the game
 * schema. Used by every season's ingest script (96/97, 97/98, …).
 */
import type { League, Player, Position } from '../schemas';
import { syntheticPlayerId, slugify } from './syntheticId';

export interface SourceAttributes {
  calidad: number | null;
  agresividad: number;
  resistencia: number;
  velocidad: number;
  fisico: number;
  remate: number;
  ofensivo: number;
  pase: number;
  entrada: number;
  porteria: number;
}

export interface SourcePlayer {
  nombre: string;
  nombre_completo: string;
  es_portero: boolean;
  demarcaciones: number[];
  media: number;
  atributos: SourceAttributes;
  // Bio fields are optional: the earliest packs (e.g. 93/94) store no birth
  // year, birth date, height or weight. Absent => treated as unknown (null).
  anho_nacimiento?: number | null;
  fecha_nacimiento?: string | null;
  altura_cm?: number | null;
  peso_kg?: number | null;
  nacionalidad?: string | null;
  club_anterior?: string | null;
  // Explicit pitch-line byte from the player record (0=POR,1=DEF,2=MED,3=DEL):
  // the authoritative position source (PCF5 PKF idx11 / PCF7–2000 FDI date−1, see
  // analysis findings/13). Absent (null) only for the classic 93/94–94/95 packs,
  // whose record hasn't been decoded — those fall back to the attribute heuristic.
  linea?: number | null;
}

export interface SourceTeam {
  indice_pkf: number;
  equipo: string;
  jugadores: SourcePlayer[];
}

/** A single-team source file (e.g. the base-edition Extremadura extract). */
export interface ExtraTeamFile {
  equipo: string;
  jugadores: SourcePlayer[];
}

/** DD/MM/YYYY -> ISO YYYY-MM-DD; null when unparseable. */
export function toIsoDate(ddmmyyyy: string | null): string | null {
  if (!ddmmyyyy) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Derive the coarse pitch line. The authoritative source is the explicit line
 * byte in the player record (`linea`: 0=POR,1=DEF,2=MED,3=DEL), reverse-engineered
 * from the game binaries (see analysis findings/13). Only the classic 93/94–94/95
 * packs lack it; those fall back to the old attribute heuristic (goalkeepers
 * flagged directly, outfielders classified by which attribute group dominates).
 */
export function derivePosition(p: SourcePlayer): Position {
  switch (p.linea) {
    case 0:
      return 'POR';
    case 1:
      return 'DEF';
    case 2:
      return 'MED';
    case 3:
      return 'DEL';
  }
  // Fallback — classic seasons without a decoded line byte:
  if (p.es_portero) return 'POR';
  const a = p.atributos;
  const attack = a.remate * 0.6 + a.ofensivo * 0.4;
  const midfield = a.pase * 0.6 + a.ofensivo * 0.4;
  const defense = a.entrada;
  const best = Math.max(attack, midfield, defense);
  if (best === defense) return 'DEF';
  if (best === attack) return 'DEL';
  return 'MED';
}

/**
 * Clamp attribute ratings into the schema's valid 0–99 range. Real cards are
 * always in range, so a clamp only ever fires on an isolated corrupt/misaligned
 * byte in the extraction; when it does we warn (and count it) rather than crash
 * the whole ingest. Clean seasons pass through untouched.
 *
 * `baseline` (the player's overall media, clamped) fills any attribute the
 * source left absent or non-finite — a rare partial-decode row in the earliest
 * packs (e.g. a single 94/95 player with only 4 of the 10 attributes decoded).
 * Keeping the player with a neutral estimate is preferable to dropping him.
 */
function sanitizeAttributes(src: SourceAttributes, who: string, baseline: number): SourceAttributes {
  const fix = (key: keyof SourceAttributes, value: number | null | undefined): number | null => {
    if (value === null) return null;
    if (value === undefined || !Number.isFinite(value)) {
      console.warn(`WARN: ${who} atributo ${key} ausente -> ${baseline}`);
      return baseline;
    }
    if (value >= 0 && value <= 99) return value;
    const clamped = Math.max(0, Math.min(99, value));
    console.warn(`WARN: ${who} atributo ${key}=${value} fuera de rango -> ${clamped}`);
    return clamped;
  };
  return {
    calidad: fix('calidad', src.calidad),
    agresividad: fix('agresividad', src.agresividad) ?? baseline,
    resistencia: fix('resistencia', src.resistencia) ?? baseline,
    velocidad: fix('velocidad', src.velocidad) ?? baseline,
    fisico: fix('fisico', src.fisico) ?? baseline,
    remate: fix('remate', src.remate) ?? baseline,
    ofensivo: fix('ofensivo', src.ofensivo) ?? baseline,
    pase: fix('pase', src.pase) ?? baseline,
    entrada: fix('entrada', src.entrada) ?? baseline,
    porteria: fix('porteria', src.porteria) ?? baseline,
  };
}

export function transformPlayer(src: SourcePlayer, teamId: string): Player {
  const nacionalidad = src.nacionalidad ?? null;
  // Synthetic squad-fillers in the earliest packs carry no full name; fall back
  // to the short name so the id stays unique and the schema (min length 1) holds.
  const nombreCompleto = (src.nombre_completo ?? '').trim() || src.nombre;
  const baseline = Math.max(0, Math.min(99, Math.round(src.media)));
  return {
    id: syntheticPlayerId(nombreCompleto, src.anho_nacimiento ?? null, teamId),
    nombre: src.nombre,
    nombreCompleto,
    posicion: derivePosition(src),
    // Line byte 0 is a cleaner goalkeeper detector than the porteria attribute
    // (findings/13); fall back to the source flag only when no line was decoded.
    esPortero: src.linea != null ? src.linea === 0 : src.es_portero,
    demarcaciones: src.demarcaciones,
    atributos: sanitizeAttributes(src.atributos, `${teamId}/${src.nombre}`, baseline),
    media: src.media,
    dorsal: null,
    fechaNacimiento: toIsoDate(src.fecha_nacimiento ?? null),
    alturaCm: src.altura_cm ?? null,
    pesoKg: src.peso_kg ?? null,
    nacionalidad: nacionalidad === '0' ? null : nacionalidad,
    clubAnterior: src.club_anterior ?? null,
  };
}

/** Build a game team from a source team's name and raw players. */
export function buildTeam(nombre: string, jugadores: SourcePlayer[]): League['equipos'][number] {
  const teamId = slugify(nombre);
  const players = jugadores
    .filter((p) => p.media > 0) // drop empty/placeholder rows
    .map((p) => transformPlayer(p, teamId));
  if (players.length < 16) {
    console.warn(`WARN: ${nombre} only has ${players.length} usable players`);
  }
  return { id: teamId, nombre, jugadores: players };
}
