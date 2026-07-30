/**
 * Dev-only ingest for the Segunda División databases (one per season).
 *
 * Run with: `npm run ingest:segunda`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * Unlike Primera (a fixed set of 22 clubs with fallback), Segunda simply takes
 * whatever clubs the source provides for that season — coverage varies by pack
 * (see config `SEGUNDA_SOURCES`).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LeagueSchema, type League } from '../schemas';
import { buildTeam, type SourcePlayer } from './transform';
import { SEGUNDA_SOURCES } from './config';

interface SegundaSourceTeam {
  equipo: string;
  jugadores: SourcePlayer[];
}

interface SegundaSourceFile {
  temporada: string;
  equipos: SegundaSourceTeam[];
}

function main(): void {
  for (const spec of SEGUNDA_SOURCES) {
    const source = JSON.parse(readFileSync(spec.source, 'utf8')) as SegundaSourceFile;
    const equipos = source.equipos.map((t) => buildTeam(t.equipo, t.jugadores));

    const league: League = {
      id: spec.id,
      nombre: 'Segunda División',
      pais: 'España',
      temporada: spec.temporada,
      competicion: { kind: 'league', rounds: 2, relegationSpots: 4, pointsForWin: 3 },
      equipos,
    };

    LeagueSchema.parse(league);

    const outPath = resolve(process.cwd(), spec.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(league, null, 2)}\n`, 'utf8');

    const totalPlayers = equipos.reduce((sum, t) => sum + t.jugadores.length, 0);
    console.log(`OK: ${equipos.length} equipos, ${totalPlayers} jugadores -> ${spec.output}`);
  }
}

main();
