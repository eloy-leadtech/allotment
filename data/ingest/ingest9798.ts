/**
 * Dev-only ingest for the 97/98 Primera database `data/db/es-primera-9798.json`.
 *
 * Run with: `npm run ingest:9798`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * MVP rule (no promotion/relegation yet): keep the SAME fixed 22 clubs as 96/97.
 * 17 of them have a real 97/98 roster (from the RE source); the 5 that were
 * relegated fall back to their committed 96/97 roster verbatim (aging is applied
 * later by the career layer, never at ingest time).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourcePlayer } from './transform';
import {
  SOURCE_PATH_9798,
  FALLBACK_DB_9697,
  OUTPUT_RELATIVE_9798,
  RELEGATION_SPOTS,
} from './config';
import { slugify } from './syntheticId';

interface Source9798Team {
  equipo: string;
  en_primera_9798: boolean;
  jugadores: SourcePlayer[];
}

interface Source9798File {
  temporada: string;
  fuente: string;
  equipos: Source9798Team[];
  fallback: string[];
}

function main(): void {
  const source = JSON.parse(readFileSync(SOURCE_PATH_9798, 'utf8')) as Source9798File;

  // Real 97/98 rosters, keyed by the same slug id the 96/97 database uses.
  const realById = new Map(
    source.equipos
      .filter((t) => t.en_primera_9798)
      .map((t) => [slugify(t.equipo), buildTeam(t.equipo, t.jugadores)] as const),
  );

  // The committed 96/97 league defines our fixed 22 clubs (order and ids).
  const base = JSON.parse(
    readFileSync(resolve(process.cwd(), FALLBACK_DB_9697), 'utf8'),
  ) as League;

  const fallbackIds: string[] = [];
  const equipos = base.equipos.map((team96) => {
    const real = realById.get(team96.id);
    if (real) return real;
    fallbackIds.push(team96.id); // relegated in 97/98 -> reuse 96/97 roster
    return team96;
  });

  if (equipos.length !== 22) {
    throw new Error(`Expected 22 clubs, got ${equipos.length}`);
  }
  const expectedFallback = source.fallback.map(slugify).sort();
  if (JSON.stringify([...fallbackIds].sort()) !== JSON.stringify(expectedFallback)) {
    throw new Error(
      `Fallback mismatch: got [${fallbackIds.join(', ')}], expected [${expectedFallback.join(', ')}]`,
    );
  }

  const league: League = {
    id: 'es-primera-9798',
    nombre: 'Primera División',
    pais: 'España',
    temporada: '97/98',
    competicion: { kind: 'league', rounds: 2, relegationSpots: RELEGATION_SPOTS, pointsForWin: 3 },
    equipos,
  };

  // Fail loudly if the transform produced anything the schema rejects.
  LeagueSchema.parse(league);

  const outPath = resolve(process.cwd(), OUTPUT_RELATIVE_9798);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

  const totalPlayers = equipos.reduce((sum, t) => sum + t.jugadores.length, 0);
  console.log(
    `OK: ${equipos.length} equipos (${realById.size} reales 97/98, ${fallbackIds.length} fallback ` +
      `96/97: ${fallbackIds.join(', ')}), ${totalPlayers} jugadores -> ${OUTPUT_RELATIVE_9798}`,
  );
}

main();
