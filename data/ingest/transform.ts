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
  anho_nacimiento: number | null;
  fecha_nacimiento: string | null;
  altura_cm: number | null;
  peso_kg: number | null;
  nacionalidad: string | null;
  club_anterior: string | null;
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
 * Derive the coarse pitch line from attributes (the source demarcation codes are
 * not yet decoded). Goalkeepers are flagged directly; outfielders are classified
 * by which attribute group dominates.
 */
export function derivePosition(p: SourcePlayer): Position {
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
 */
function sanitizeAttributes(src: SourceAttributes, who: string): SourceAttributes {
  const fix = (key: keyof SourceAttributes, value: number | null): number | null => {
    if (value === null || (value >= 0 && value <= 99)) return value;
    const clamped = Math.max(0, Math.min(99, value));
    console.warn(`WARN: ${who} atributo ${key}=${value} fuera de rango -> ${clamped}`);
    return clamped;
  };
  return {
    calidad: fix('calidad', src.calidad),
    agresividad: fix('agresividad', src.agresividad) ?? 0,
    resistencia: fix('resistencia', src.resistencia) ?? 0,
    velocidad: fix('velocidad', src.velocidad) ?? 0,
    fisico: fix('fisico', src.fisico) ?? 0,
    remate: fix('remate', src.remate) ?? 0,
    ofensivo: fix('ofensivo', src.ofensivo) ?? 0,
    pase: fix('pase', src.pase) ?? 0,
    entrada: fix('entrada', src.entrada) ?? 0,
    porteria: fix('porteria', src.porteria) ?? 0,
  };
}

export function transformPlayer(src: SourcePlayer, teamId: string): Player {
  return {
    id: syntheticPlayerId(src.nombre_completo, src.anho_nacimiento, teamId),
    nombre: src.nombre,
    nombreCompleto: src.nombre_completo,
    posicion: derivePosition(src),
    esPortero: src.es_portero,
    demarcaciones: src.demarcaciones,
    atributos: sanitizeAttributes(src.atributos, `${teamId}/${src.nombre}`),
    media: src.media,
    dorsal: null,
    fechaNacimiento: toIsoDate(src.fecha_nacimiento),
    alturaCm: src.altura_cm,
    pesoKg: src.peso_kg,
    nacionalidad: src.nacionalidad === '0' ? null : src.nacionalidad,
    clubAnterior: src.club_anterior,
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
