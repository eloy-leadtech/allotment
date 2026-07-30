/**
 * Dev-only ingest for the 98/99 Primera database `data/db/es-primera-9899.json`.
 *
 * Run with: `npm run ingest:9899`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * MVP rule (no promotion/relegation yet): keep the SAME fixed 22 clubs. 16 have a
 * real 98/99 roster (from PC Fútbol 7.0); the 6 not in Primera 98/99 fall back to
 * their committed 97/98 roster (one year fresher than the 96/97 fallback used for
 * the 97/98 database). The 98/99 promoted clubs are ignored for now.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourcePlayer } from './transform';
import {
  SOURCE_PATH_9899,
  FALLBACK_DB_9798,
  OUTPUT_RELATIVE_9899,
  RELEGATION_SPOTS,
} from './config';
import { slugify } from './syntheticId';

interface Source9899Team {
  equipo: string;
  en_primera_9899: boolean;
  jugadores: SourcePlayer[];
}

interface Source9899File {
  temporada: string;
  fuente: string;
  equipos: Source9899Team[];
}

function main(): void {
  const source = JSON.parse(readFileSync(SOURCE_PATH_9899, 'utf8')) as Source9899File;

  // Real 98/99 rosters, keyed by the same slug id the earlier databases use.
  const realById = new Map(
    source.equipos
      .filter((t) => t.en_primera_9899)
      .map((t) => [slugify(t.equipo), buildTeam(t.equipo, t.jugadores)] as const),
  );

  // The committed 97/98 league defines our fixed 22 clubs (order and ids).
  const base = JSON.parse(
    readFileSync(resolve(process.cwd(), FALLBACK_DB_9798), 'utf8'),
  ) as League;

  const fallbackIds: string[] = [];
  let realUsed = 0;
  const equipos = base.equipos.map((prev) => {
    const real = realById.get(prev.id);
    if (real) {
      realUsed += 1;
      return real;
    }
    fallbackIds.push(prev.id); // not in Primera 98/99 -> reuse 97/98 roster
    return prev;
  });

  if (equipos.length !== 22) {
    throw new Error(`Expected 22 clubs, got ${equipos.length}`);
  }
  if (realUsed + fallbackIds.length !== 22) {
    throw new Error(`Roster accounting mismatch: ${realUsed} real + ${fallbackIds.length} fallback`);
  }

  const league: League = {
    id: 'es-primera-9899',
    nombre: 'Primera División',
    pais: 'España',
    temporada: '98/99',
    competicion: { kind: 'league', rounds: 2, relegationSpots: RELEGATION_SPOTS, pointsForWin: 3 },
    equipos,
  };

  // Fail loudly if the transform produced anything the schema rejects.
  LeagueSchema.parse(league);

  const outPath = resolve(process.cwd(), OUTPUT_RELATIVE_9899);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

  const totalPlayers = equipos.reduce((sum, t) => sum + t.jugadores.length, 0);
  console.log(
    `OK: ${equipos.length} equipos (${realUsed} reales 98/99, ${fallbackIds.length} fallback ` +
      `97/98: ${fallbackIds.join(', ')}), ${totalPlayers} jugadores -> ${OUTPUT_RELATIVE_9899}`,
  );
}

main();
