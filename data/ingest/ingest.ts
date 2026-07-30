/**
 * Dev-only ingest script. Transforms the reverse-engineered dataset (outside the
 * repo) into the committed game database `data/db/es-primera-9697.json`.
 *
 * Run with: `npm run ingest`
 * It is NOT part of the app build or the CI: the generated JSON is committed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League, type Player, type Position } from '../schemas';
import { syntheticPlayerId, slugify } from './syntheticId';
import {
  SOURCE_PATH,
  EXTREMADURA_SOURCE,
  OUTPUT_RELATIVE,
  PRIMERA_9697,
  RELEGATION_SPOTS,
} from './config';

interface SourceAttributes {
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

interface SourcePlayer {
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

interface SourceTeam {
  indice_pkf: number;
  equipo: string;
  jugadores: SourcePlayer[];
}

interface SourceFile {
  titulo: string;
  temporada: string;
  equipos: SourceTeam[];
}

/** DD/MM/YYYY -> ISO YYYY-MM-DD; null when unparseable. */
function toIsoDate(ddmmyyyy: string | null): string | null {
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
function derivePosition(p: SourcePlayer): Position {
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

function transformPlayer(src: SourcePlayer, teamId: string): Player {
  return {
    id: syntheticPlayerId(src.nombre_completo, src.anho_nacimiento, teamId),
    nombre: src.nombre,
    nombreCompleto: src.nombre_completo,
    posicion: derivePosition(src),
    esPortero: src.es_portero,
    demarcaciones: src.demarcaciones,
    atributos: { ...src.atributos },
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
function buildTeam(nombre: string, jugadores: SourcePlayer[]): League['equipos'][number] {
  const teamId = slugify(nombre);
  const players = jugadores
    .filter((p) => p.media > 0) // drop empty/placeholder rows
    .map((p) => transformPlayer(p, teamId));
  if (players.length < 16) {
    console.warn(`WARN: ${nombre} only has ${players.length} usable players`);
  }
  return { id: teamId, nombre, jugadores: players };
}

interface ExtraTeamFile {
  equipo: string;
  jugadores: SourcePlayer[];
}

function main(): void {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf8')) as SourceFile;
  const byName = new Map(source.equipos.map((t) => [t.equipo, t]));

  const missing = PRIMERA_9697.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new Error(`Whitelisted teams not found in source: ${missing.join(', ')}`);
  }

  // 21 Primera clubs from the main pack.
  const packTeams = PRIMERA_9697.map((name) => {
    const team = byName.get(name);
    if (!team) throw new Error(`Team not found: ${name}`);
    return buildTeam(name, team.jugadores);
  });

  // The 22nd Primera club (Extremadura) from the base-edition source.
  const extra = JSON.parse(readFileSync(EXTREMADURA_SOURCE, 'utf8')) as ExtraTeamFile;
  const equipos = [...packTeams, buildTeam(extra.equipo, extra.jugadores)];

  const league: League = {
    id: 'es-primera-9697',
    nombre: 'Primera División',
    pais: 'España',
    temporada: '96/97',
    competicion: { kind: 'league', rounds: 2, relegationSpots: RELEGATION_SPOTS, pointsForWin: 3 },
    equipos,
  };

  // Fail loudly if the transform produced anything the schema rejects.
  LeagueSchema.parse(league);

  const outPath = resolve(process.cwd(), OUTPUT_RELATIVE);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

  const totalPlayers = equipos.reduce((sum, t) => sum + t.jugadores.length, 0);
  console.log(`OK: ${equipos.length} equipos, ${totalPlayers} jugadores -> ${OUTPUT_RELATIVE}`);
}

main();
