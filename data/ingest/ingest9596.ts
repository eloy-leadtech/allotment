/**
 * Dev-only ingest for the 95/96 databases (Primera + Segunda).
 *
 * Run with: `npm run ingest:9596`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * 95/96 is its own real set of clubs (no fixed-22, no fallback). It comes from PC
 * Fútbol 4.1, whose 10 game attributes are SYNTHESIZED from 4 raw ones — lower
 * fidelity, flagged in the season name.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourcePlayer } from './transform';
import { SOURCE_PATH_9596_PRIMERA, SOURCE_PATH_9596_SEGUNDA } from './config';

interface SourceTeam {
  equipo: string;
  jugadores: SourcePlayer[];
}
interface SourceFile {
  temporada: string;
  equipos: SourceTeam[];
}

function ingest(sourcePath: string, id: string, nombre: string, output: string): void {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceFile;
  const equipos = source.equipos.map((t) => buildTeam(t.equipo, t.jugadores));
  const league: League = {
    id,
    nombre,
    pais: 'España',
    temporada: '95/96',
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
  ingest(SOURCE_PATH_9596_PRIMERA, 'es-primera-9596', 'Primera División', 'data/db/es-primera-9596.json');
  ingest(SOURCE_PATH_9596_SEGUNDA, 'es-segunda-9596', 'Segunda División', 'data/db/es-segunda-9596.json');
}

main();
