/**
 * Dev-only ingest for national-team squads (tournaments).
 *
 * Run with: `npm run ingest:selecciones`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * For now only Euro 2000 (FDI late format, full 10 attributes). Euro 96 and
 * Mundial 98 are parked until their attribute mapping is cracked. The teams are
 * stored in a League container with a placeholder competicion — the tournament
 * bracket lives in the game layer, not the data.
 *
 * Two source quirks are handled here: the pack lists "España" twice (a full
 * squad plus a 1-player stub — we keep the fuller one), and every player's
 * `nombre_completo` is actually their CLUB (an FDI artifact), so player ids are
 * built from the display `nombre` plus an index instead, guaranteeing uniqueness.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League, type Team } from '../schemas';
import { transformPlayer, type SourcePlayer } from './transform';
import { slugify } from './syntheticId';
import { SELECCION_EURO2000_SOURCE, OUTPUT_RELATIVE_EURO2000 } from './config';

interface SeleccionSource {
  seleccion: string;
  jugadores: SourcePlayer[];
}

interface SeleccionesFile {
  torneo: string;
  selecciones: SeleccionSource[];
}

/** Build one national team with robust, unique player ids. */
function buildSeleccion(nombre: string, jugadores: SourcePlayer[]): Team {
  const teamId = slugify(nombre);
  const players = jugadores
    .filter((p) => p.media > 0)
    .map((src, i) => ({ ...transformPlayer(src, teamId), id: `${teamId}-${i + 1}-${slugify(src.nombre)}` }));
  return { id: teamId, nombre, jugadores: players };
}

function main(): void {
  const source = JSON.parse(readFileSync(SELECCION_EURO2000_SOURCE, 'utf8')) as SeleccionesFile;

  // Deduplicate national teams by slug, keeping the fuller squad.
  const bySlug = new Map<string, SeleccionSource>();
  for (const sel of source.selecciones) {
    const key = slugify(sel.seleccion);
    const prev = bySlug.get(key);
    if (!prev || sel.jugadores.length > prev.jugadores.length) bySlug.set(key, sel);
  }

  const equipos = [...bySlug.values()]
    .map((s) => buildSeleccion(s.seleccion, s.jugadores))
    .filter((t) => t.jugadores.length >= 11); // a squad must be playable

  const league: League = {
    id: 'seleccion-euro2000',
    nombre: 'Eurocopa 2000',
    pais: 'Europa',
    temporada: 'Euro 2000',
    competicion: { kind: 'league', rounds: 2, relegationSpots: 0, pointsForWin: 3 },
    equipos,
  };

  LeagueSchema.parse(league);

  // Sanity: player ids must be unique across the whole file.
  const ids = equipos.flatMap((t) => t.jugadores.map((p) => p.id));
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate player ids after build');
  }

  const outPath = resolve(process.cwd(), OUTPUT_RELATIVE_EURO2000);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

  console.log(`OK: ${equipos.length} selecciones, ${ids.length} jugadores -> ${OUTPUT_RELATIVE_EURO2000}`);
}

main();
