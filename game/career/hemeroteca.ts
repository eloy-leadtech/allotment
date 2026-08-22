/**
 * Hemeroteca de carrera — the club's press archive, PC Fútbol style.
 *
 * A chronological roll of the career's MILESTONES ("hitos"): titles, promotions
 * and relegations, individual trophies won by YOUR players, cracks who hang up
 * their boots, record signings and sales, and the board's verdict (objective
 * met/missed, sacking or a public vote of confidence).
 *
 * Pure and deterministic: each headline is a plain function of hito data the
 * career already computes at the exact point the hito occurs — the season
 * transition (end-of-season hitos) and the transfer window (record deals). This
 * module only PHRASES those facts as press headlines; it never re-derives them
 * (no standings, no objectives, no development recomputed here), so the same
 * career always produces the same hemeroteca.
 */
import type { Player } from '@data';
import type { Pichichi, Zamora } from '@engine';
import type { PalmaresTitle } from './types';
import type { ObjectiveEvaluation } from './board';
import type { PromotionOutcome } from './promotion';
import { palmaresCompetitionLabel } from './palmares';
import { formatEuros } from './market';

/**
 * The flavour of a hemeroteca headline. Drives the icon shown in the UI; the
 * human-readable story is carried in the event's `text`.
 */
export type HemerotecaEventType =
  | 'titulo' // won a competition (liga/copa/champions/uefa)
  | 'ascenso' // promoted to Primera
  | 'descenso' // relegated to Segunda
  | 'pichichi' // one of your players was the league top scorer
  | 'zamora' // one of your keepers won the Zamora
  | 'retirada' // a crack of your squad retired
  | 'fichaje' // a new club-record purchase
  | 'traspaso' // a new club-record sale
  | 'objetivo' // the board's season verdict (objective met or missed)
  | 'cese' // the board sacked the manager
  | 'confianza'; // the board publicly backed the manager despite a bad season

/**
 * One dated headline in the club's hemeroteca. `temporada`/`seasonNumber` place
 * it in time; `type` gives the icon; `text` is the ready-to-render story. Record
 * transfers also carry the `amount` (whole euros) so the running record can be
 * read straight back from the archive with no separate bookkeeping.
 */
export interface HemerotecaEvent {
  /** 1-indexed career season the headline belongs to. */
  seasonNumber: number;
  /** Season label, e.g. "96/97". */
  temporada: string;
  type: HemerotecaEventType;
  /** The headline text (press style, Spanish). */
  text: string;
  /** For 'fichaje'/'traspaso' only: the fee, so the record can be read back. */
  amount?: number;
}

/** A player of your squad is a "crack" worth a retirement headline at this rating. */
export const CRACK_MEDIA = 75;

/** Icon for a headline type (retro press cue). */
export function hemerotecaEventIcon(type: HemerotecaEventType): string {
  switch (type) {
    case 'titulo':
      return '🏆';
    case 'ascenso':
      return '⬆️';
    case 'descenso':
      return '⬇️';
    case 'pichichi':
      return '⚽';
    case 'zamora':
      return '🧤';
    case 'retirada':
      return '👋';
    case 'fichaje':
      return '💰';
    case 'traspaso':
      return '💸';
    case 'objetivo':
      return '🎯';
    case 'cese':
      return '⛔';
    case 'confianza':
      return '🤝';
  }
}

/** The headline for a single title, keyed off the competition it was won in. */
function titleHeadline(team: string, title: PalmaresTitle): string {
  const label = palmaresCompetitionLabel(title.competition, title.division);
  switch (title.competition) {
    case 'liga':
      return `¡CAMPEONES! El ${team} conquista la ${label}.`;
    case 'copa':
      return `¡COPA DEL REY! El ${team} levanta el título copero.`;
    case 'champions':
      return `¡CAMPEÓN DE EUROPA! El ${team} gana la ${label}.`;
    case 'uefa':
      return `¡TÍTULO CONTINENTAL! El ${team} conquista la ${label}.`;
  }
}

/** The facts a finished season contributes to the hemeroteca. */
export interface SeasonHitos {
  /** 1-indexed career season that just finished. */
  seasonNumber: number;
  /** Season label, e.g. "96/97". */
  temporada: string;
  humanTeamId: string;
  /** The human club's display name (for the headlines). */
  teamName: string;
  /** Titles the human won this season (as `titlesWonThisSeason` returns them). */
  titles: readonly PalmaresTitle[];
  /** The human's promotion/relegation outcome this season. */
  outcome: PromotionOutcome;
  /** The board's verdict on the finished season. */
  evaluation: ObjectiveEvaluation;
  /** Whether the board sacked the manager at season's end. */
  dismissed: boolean;
  /** The league Pichichi, when one was awarded (any club). */
  pichichi?: Pichichi;
  /** The league Zamora, when one was awarded (any club). */
  zamora?: Zamora;
  /** Players of the human squad who retired at this transition. */
  retirees: readonly Player[];
}

/**
 * The hemeroteca headlines a finished season produces, most important first:
 * titles, then promotion/relegation, then your individual trophies, then the
 * cracks who retired, then the board's end-of-season verdict. Pure: it only
 * phrases the hito facts handed to it (see the module note).
 */
export function seasonHeadlines(hitos: SeasonHitos): HemerotecaEvent[] {
  const { seasonNumber, temporada, teamName } = hitos;
  const at = (type: HemerotecaEventType, text: string): HemerotecaEvent => ({
    seasonNumber,
    temporada,
    type,
    text,
  });
  const events: HemerotecaEvent[] = [];

  // 1) Titles, in the order they were won (liga, copa, champions, uefa).
  for (const title of hitos.titles) {
    events.push(at('titulo', titleHeadline(teamName, title)));
  }

  // 2) Promotion / relegation.
  if (hitos.outcome === 'promoted') {
    events.push(at('ascenso', `¡ASCENSO! El ${teamName} sube a Primera División.`));
  } else if (hitos.outcome === 'relegated') {
    events.push(
      at('descenso', `DESCENSO. El ${teamName} pierde la categoría y baja a Segunda División.`),
    );
  }

  // 3) Your individual trophies (only when the winner is one of YOUR players).
  if (hitos.pichichi && hitos.pichichi.teamId === hitos.humanTeamId) {
    const p = hitos.pichichi;
    events.push(
      at(
        'pichichi',
        `Pichichi para ${p.playerName} (${teamName}): ${p.goals} ${p.goals === 1 ? 'gol' : 'goles'}, máximo goleador de la Liga.`,
      ),
    );
  }
  if (hitos.zamora && hitos.zamora.teamId === hitos.humanTeamId) {
    const z = hitos.zamora;
    events.push(
      at(
        'zamora',
        `Zamora para ${z.playerName} (${teamName}): solo ${z.goalsConceded} goles encajados en ${z.matches} ${z.matches === 1 ? 'partido' : 'partidos'}.`,
      ),
    );
  }

  // 4) Cracks who retired from your squad (best first; filler retirements are
  //    not newsworthy, so only genuine cracks make the headlines).
  const cracks = hitos.retirees
    .filter((p) => p.media >= CRACK_MEDIA)
    .slice()
    .sort((a, b) => b.media - a.media || a.id.localeCompare(b.id));
  for (const p of cracks) {
    events.push(at('retirada', `Se retira ${p.nombre}: cuelga las botas una leyenda del ${teamName}.`));
  }

  // 5) The board's end-of-season verdict: sacking, a public vote of confidence,
  //    or the plain objective met/missed line.
  if (hitos.evaluation.satisfaction === 'contento') {
    events.push(at('objetivo', `Objetivo cumplido: la directiva del ${teamName} respalda al técnico.`));
  } else if (hitos.evaluation.satisfaction === 'enfadado') {
    events.push(at('objetivo', `Objetivo incumplido: la directiva del ${teamName} monta en cólera.`));
  }
  if (hitos.dismissed) {
    events.push(at('cese', `DESTITUIDO: la directiva del ${teamName} prescinde del entrenador.`));
  } else if (hitos.evaluation.satisfaction === 'enfadado') {
    events.push(
      at('confianza', `Voto de confianza: pese al enfado, la directiva del ${teamName} mantiene al técnico.`),
    );
  }

  return events;
}

/** The current club-record fee for a transfer direction, 0 if there is none yet. */
export function recordTransferAmount(
  hemeroteca: readonly HemerotecaEvent[] | undefined,
  kind: 'compra' | 'venta',
): number {
  const type: HemerotecaEventType = kind === 'compra' ? 'fichaje' : 'traspaso';
  let max = 0;
  for (const e of hemeroteca ?? []) {
    if (e.type === type && typeof e.amount === 'number' && e.amount > max) max = e.amount;
  }
  return max;
}

/** The facts a completed transfer contributes when it sets a new club record. */
export interface RecordTransfer {
  kind: 'compra' | 'venta';
  seasonNumber: number;
  temporada: string;
  /** The human club's display name. */
  teamName: string;
  /** The player bought or sold. */
  playerName: string;
  /** The fee, in whole euros. */
  amount: number;
}

/**
 * The hemeroteca after a transfer: unchanged if the fee does NOT beat the club's
 * standing record for that direction (buy/sell), or with a fresh record headline
 * appended if it does. Called at the transfer chokepoints so a record deal is
 * archived the moment it happens. Pure and deterministic.
 */
export function recordTransferHeadline(
  hemeroteca: HemerotecaEvent[] | undefined,
  transfer: RecordTransfer,
): HemerotecaEvent[] | undefined {
  if (transfer.amount <= recordTransferAmount(hemeroteca, transfer.kind)) {
    return hemeroteca;
  }
  const event: HemerotecaEvent =
    transfer.kind === 'compra'
      ? {
          seasonNumber: transfer.seasonNumber,
          temporada: transfer.temporada,
          type: 'fichaje',
          text: `Fichaje récord: el ${transfer.teamName} paga ${formatEuros(transfer.amount)} por ${transfer.playerName}.`,
          amount: transfer.amount,
        }
      : {
          seasonNumber: transfer.seasonNumber,
          temporada: transfer.temporada,
          type: 'traspaso',
          text: `Traspaso récord: el ${transfer.teamName} vende a ${transfer.playerName} por ${formatEuros(transfer.amount)}.`,
          amount: transfer.amount,
        };
  return [...(hemeroteca ?? []), event];
}
