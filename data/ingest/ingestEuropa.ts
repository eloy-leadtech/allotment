/**
 * Dev-only ingest for the European club databases (one per season).
 *
 * Run with: `npm run ingest:europa`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * These are top European clubs pulled from the late FDI packs (full 10
 * attributes present). Like the national-team squads, they are stored in a
 * League container with a placeholder `competicion` — the real bracket
 * (Champions/UEFA) lives in the game layer, not the data. Player ids are built
 * from the display `nombre` plus an index (robust against noisy FDI
 * `nombre_completo` values and intra-team name collisions).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League, type Team } from '../schemas';
import { transformPlayer, type SourcePlayer } from './transform';
import { slugify } from './syntheticId';
import { EUROPA_SOURCES } from './config';

interface EuropaSourceTeam {
  equipo: string;
  pais?: string;
  jugadores: SourcePlayer[];
}

interface EuropaSourceFile {
  temporada: string;
  equipos: EuropaSourceTeam[];
}

/** Build one European club with robust, unique player ids. */
function buildEuropaTeam(nombre: string, jugadores: SourcePlayer[]): Team {
  const teamId = slugify(nombre);
  const players = jugadores
    .filter((p) => p.media > 0)
    .map((src, i) => ({ ...transformPlayer(src, teamId), id: `${teamId}-${i + 1}-${slugify(src.nombre)}` }));
  return { id: teamId, nombre, jugadores: players };
}

function main(): void {
  for (const spec of EUROPA_SOURCES) {
    const source = JSON.parse(readFileSync(spec.source, 'utf8')) as EuropaSourceFile;

    // Deduplicate clubs by slug, keeping the fuller squad (guards FDI dupes).
    const bySlug = new Map<string, EuropaSourceTeam>();
    for (const t of source.equipos) {
      const key = slugify(t.equipo);
      const prev = bySlug.get(key);
      if (!prev || t.jugadores.length > prev.jugadores.length) bySlug.set(key, t);
    }

    const equipos = [...bySlug.values()]
      .map((t) => buildEuropaTeam(t.equipo, t.jugadores))
      .filter((t) => t.jugadores.length >= 11); // a squad must be playable

    const league: League = {
      id: spec.id,
      nombre: 'Clubes de Europa',
      pais: 'Europa',
      temporada: spec.temporada,
      competicion: { kind: 'league', rounds: 2, relegationSpots: 0, pointsForWin: 3 },
      equipos,
    };

    LeagueSchema.parse(league);

    // Sanity: player ids must be unique across the whole file.
    const ids = equipos.flatMap((t) => t.jugadores.map((p) => p.id));
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Duplicate player ids after build (${spec.id})`);
    }

    const outPath = resolve(process.cwd(), spec.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

    console.log(`OK: ${equipos.length} clubes, ${ids.length} jugadores -> ${spec.output}`);
  }
}

main();
