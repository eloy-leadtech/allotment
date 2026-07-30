/**
 * Dev-only ingest script. Transforms the reverse-engineered dataset (outside the
 * repo) into the committed game database `data/db/es-primera-9697.json`.
 *
 * Run with: `npm run ingest`
 * It is NOT part of the app build or the CI: the generated JSON is committed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourceTeam, type ExtraTeamFile } from './transform';
import {
  SOURCE_PATH,
  EXTREMADURA_SOURCE,
  OUTPUT_RELATIVE,
  PRIMERA_9697,
  RELEGATION_SPOTS,
} from './config';

interface SourceFile {
  titulo: string;
  temporada: string;
  equipos: SourceTeam[];
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
