/**
 * Dev-only ingest for the AUTHENTIC Primera 96/97 calendar
 * `data/db/calendario-es-primera-9697.json` (fixtures + dates + real scores).
 *
 * Run with: `npm run ingest:cal9697`
 * Not part of the app build or CI: the generated JSON is committed.
 *
 * Source: bdfutbol match data in the analysis workspace (462 matches, 42 × 11).
 * Transforms club names → our team ids, DD/MM/YYYY → ISO, the `marcador` string →
 * numeric goals. Fails loudly on any unknown club, malformed date/score, or a
 * count that is not the expected 22-team double round-robin.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { SeasonCalendarSchema, type SeasonCalendar, type RealFixture } from '../schemas';
import {
  CALENDAR_SOURCE_9697,
  CALENDAR_OUTPUT_9697,
  CALENDAR_TEAM_ID_9697,
} from './config';

interface SourceMatch {
  jornada: number;
  fecha: string; // DD/MM/YYYY
  local: string;
  visitante: string;
  marcador: string; // "x-y"
}

interface SourceFile {
  fichero: string;
  partidos: Record<string, SourceMatch>;
}

const LEAGUE_ID = 'es-primera-9697';
const TEMPORADA = '96/97';
const EXPECTED_MATCHES = 462; // 22 teams, double round-robin
const EXPECTED_ROUNDS = 42;

/** Resolve a bdfutbol club name to our team id (throws if unmapped). */
function teamId(name: string): string {
  const id = CALENDAR_TEAM_ID_9697[name];
  if (id === undefined) {
    throw new Error(`Unmapped club in source: "${name}"`);
  }
  return id;
}

/** DD/MM/YYYY → ISO yyyy-mm-dd (throws if malformed). */
function toISO(fecha: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
  if (!m) {
    throw new Error(`Malformed date: "${fecha}"`);
  }
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** "x-y" → [x, y] (throws if malformed). */
function parseScore(marcador: string): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec(marcador);
  if (!m || m[1] === undefined || m[2] === undefined) {
    throw new Error(`Malformed score: "${marcador}"`);
  }
  return [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10)];
}

function main(): void {
  const source = JSON.parse(readFileSync(CALENDAR_SOURCE_9697, 'utf8')) as SourceFile;
  const matches = Object.values(source.partidos);

  const partidos: RealFixture[] = matches.map((m) => {
    const [homeGoals, awayGoals] = parseScore(m.marcador);
    return {
      jornada: m.jornada,
      fechaISO: toISO(m.fecha),
      homeId: teamId(m.local),
      awayId: teamId(m.visitante),
      homeGoals,
      awayGoals,
    };
  });

  // Stable committed order: by matchday, then date, then home id.
  partidos.sort(
    (a, b) =>
      a.jornada - b.jornada ||
      a.fechaISO.localeCompare(b.fechaISO) ||
      a.homeId.localeCompare(b.homeId),
  );

  if (partidos.length !== EXPECTED_MATCHES) {
    throw new Error(`Expected ${EXPECTED_MATCHES} matches, got ${partidos.length}`);
  }
  const rounds = new Set(partidos.map((p) => p.jornada));
  if (rounds.size !== EXPECTED_ROUNDS) {
    throw new Error(`Expected ${EXPECTED_ROUNDS} rounds, got ${rounds.size}`);
  }
  for (const r of rounds) {
    const n = partidos.filter((p) => p.jornada === r).length;
    if (n !== 11) {
      throw new Error(`Round ${r} has ${n} matches, expected 11`);
    }
  }

  const calendar: SeasonCalendar = {
    leagueId: LEAGUE_ID,
    temporada: TEMPORADA,
    fuente: 'bdfutbol.com (ESP_1996-97_div1) vía laboratorio de ingeniería inversa',
    partidos,
  };

  // Fail loudly if the transform produced anything the schema rejects.
  SeasonCalendarSchema.parse(calendar);

  const outPath = resolve(process.cwd(), CALENDAR_OUTPUT_9697);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(calendar, null, 2)}\n`, 'utf8');

  console.log(
    `OK: ${partidos.length} partidos, ${rounds.size} jornadas -> ${CALENDAR_OUTPUT_9697}`,
  );
}

main();
