/**
 * Dev-only ingest for the Mundial 98 national teams.
 *
 * Run with: `npm run ingest:mundial98`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * Attributes are the REAL (de-permuted) values where the 6.5 container exposed
 * them; the players it did not cover (4 minor finalists) get a per-position
 * baseline so every squad is playable. Player ids are built from the display
 * name + index (unique per team).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League, type Team } from '../schemas';
import { transformPlayer, type SourcePlayer, type SourceAttributes } from './transform';
import { slugify } from './syntheticId';
import { SELECCION_MUNDIAL98_SOURCE, OUTPUT_RELATIVE_MUNDIAL98 } from './config';

interface SeleccionSource {
  seleccion: string;
  jugadores: SourcePlayer[];
}
interface SeleccionesFile {
  selecciones: SeleccionSource[];
}

/** Baseline attributes for a player the source left without ratings. */
function baseline(esPortero: boolean): SourceAttributes {
  return esPortero
    ? { calidad: 50, agresividad: 50, resistencia: 50, velocidad: 45, fisico: 50, remate: 20, ofensivo: 20, pase: 35, entrada: 25, porteria: 55 }
    : { calidad: 48, agresividad: 50, resistencia: 52, velocidad: 52, fisico: 50, remate: 45, ofensivo: 45, pase: 48, entrada: 48, porteria: 10 };
}

/** Normalize a source player: coerce nullable flags and fill missing ratings. */
function withRatings(raw: SourcePlayer): SourcePlayer {
  // The 6.5 container leaves some flags null; the game schema needs concrete values.
  const src: SourcePlayer = {
    ...raw,
    es_portero: raw.es_portero ?? false,
    demarcaciones: raw.demarcaciones ?? [],
  };
  const a = src.atributos;
  const hasRatings = src.media > 0 && a != null && a.porteria != null && a.entrada != null;
  if (hasRatings) return src;
  return { ...src, media: src.media > 0 ? src.media : 48, atributos: baseline(src.es_portero) };
}

function buildSeleccion(nombre: string, jugadores: SourcePlayer[]): Team {
  const teamId = slugify(nombre);
  const players = jugadores
    .map(withRatings)
    .map((src, i) => ({ ...transformPlayer(src, teamId), id: `${teamId}-${i + 1}-${slugify(src.nombre)}` }));
  return { id: teamId, nombre, jugadores: players };
}

function main(): void {
  const source = JSON.parse(readFileSync(SELECCION_MUNDIAL98_SOURCE, 'utf8')) as SeleccionesFile;

  const bySlug = new Map<string, SeleccionSource>();
  for (const sel of source.selecciones) {
    const key = slugify(sel.seleccion);
    const prev = bySlug.get(key);
    if (!prev || sel.jugadores.length > prev.jugadores.length) bySlug.set(key, sel);
  }

  const equipos = [...bySlug.values()]
    .map((s) => buildSeleccion(s.seleccion, s.jugadores))
    .filter((t) => t.jugadores.length >= 11);

  const league: League = {
    id: 'seleccion-mundial98',
    nombre: 'Mundial 98',
    pais: 'Mundo',
    temporada: 'Mundial 98',
    competicion: { kind: 'league', rounds: 2, relegationSpots: 0, pointsForWin: 3 },
    equipos,
  };

  LeagueSchema.parse(league);
  const ids = equipos.flatMap((t) => t.jugadores.map((p) => p.id));
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate player ids after build');

  const outPath = resolve(process.cwd(), OUTPUT_RELATIVE_MUNDIAL98);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');
  console.log(`OK: ${equipos.length} selecciones, ${ids.length} jugadores -> ${OUTPUT_RELATIVE_MUNDIAL98}`);
}

main();
