/**
 * Dev-only ingest for the 93/94 and 94/95 databases (the start of the career).
 *
 * Run with: `npm run ingest:9395`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * 93/94 is Primera only (there is no Segunda 93/94 in the source; a club
 * relegated in 93/94 plays the Segunda 94/95, which does exist). 94/95 has both
 * divisions. Each season is its own real set of clubs (no fixed-22, no
 * fallback). The source files carry extra blocks and per-player fields
 * (`sin_identificar_*`, `fuente`, `provenance`, `atributos_crudos`, …); the
 * ingest reads ONLY `equipos[].jugadores` and keeps the canonical player keys.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourcePlayer } from './transform';
import {
  SOURCE_PATH_9394_PRIMERA,
  SOURCE_PATH_9495_PRIMERA,
  SOURCE_PATH_9495_SEGUNDA,
} from './config';

interface SourceTeam {
  equipo: string;
  jugadores: SourcePlayer[];
}
interface SourceFile {
  temporada: string;
  equipos: SourceTeam[];
}

function ingest(
  sourcePath: string,
  id: string,
  nombre: string,
  temporada: string,
  output: string,
): void {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceFile;
  const equipos = source.equipos.map((t) => buildTeam(t.equipo, t.jugadores));
  const league: League = {
    id,
    nombre,
    pais: 'España',
    temporada,
    competicion: { kind: 'league', rounds: 2, relegationSpots: 4, pointsForWin: 3 },
    equipos,
  };
  LeagueSchema.parse(league);
  const outPath = resolve(process.cwd(), output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');
  const total = equipos.reduce((sum, t) => sum + t.jugadores.length, 0);
  console.log(`OK: ${equipos.length} equipos, ${total} jugadores -> ${output}`);
}

function main(): void {
  ingest(SOURCE_PATH_9394_PRIMERA, 'es-primera-9394', 'Primera División', '93/94', 'data/db/es-primera-9394.json');
  ingest(SOURCE_PATH_9495_PRIMERA, 'es-primera-9495', 'Primera División', '94/95', 'data/db/es-primera-9495.json');
  ingest(SOURCE_PATH_9495_SEGUNDA, 'es-segunda-9495', 'Segunda División', '94/95', 'data/db/es-segunda-9495.json');
}

main();
