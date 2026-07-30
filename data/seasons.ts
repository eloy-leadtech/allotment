import type { League } from './schemas';
import {
  loadPrimera9697,
  loadPrimera9798,
  loadPrimera9899,
  loadSegunda9697,
  loadSegunda9798,
  loadSegunda9899,
  loadSegunda9900,
} from './loader';

/** A playable season available in the new-game screen. */
export interface SeasonEntry {
  id: string;
  nombre: string;
  temporada: string;
  /** Loads and validates the season's league database. */
  load: () => League;
}

/**
 * Registry of available seasons. Extensible: adding a season = adding an entry
 * (and its committed JSON), no engine changes. For now only Liga 96/97 exists.
 */
export const SEASONS: readonly SeasonEntry[] = [
  { id: 'es-primera-9697', nombre: 'Liga española 96/97', temporada: '96/97', load: loadPrimera9697 },
  { id: 'es-primera-9798', nombre: 'Liga española 97/98', temporada: '97/98', load: loadPrimera9798 },
  { id: 'es-primera-9899', nombre: 'Liga española 98/99', temporada: '98/99', load: loadPrimera9899 },
];

export function getSeason(id: string): SeasonEntry | undefined {
  return SEASONS.find((s) => s.id === id);
}

/**
 * Segunda División databases, keyed like SEASONS. Coverage varies by season
 * (96/97 and 97/98 are partial — 10 clubs — from the classic pack; 98/99 and
 * 99/00 are complete). The two-division career pairs each Primera season with
 * its Segunda by `temporada`.
 */
export const SEGUNDA_SEASONS: readonly SeasonEntry[] = [
  { id: 'es-segunda-9697', nombre: 'Segunda 96/97', temporada: '96/97', load: loadSegunda9697 },
  { id: 'es-segunda-9798', nombre: 'Segunda 97/98', temporada: '97/98', load: loadSegunda9798 },
  { id: 'es-segunda-9899', nombre: 'Segunda 98/99', temporada: '98/99', load: loadSegunda9899 },
  { id: 'es-segunda-9900', nombre: 'Segunda 99/00', temporada: '99/00', load: loadSegunda9900 },
];

/** The Segunda database for a given season label, if one exists. */
export function getSegundaByTemporada(temporada: string): SeasonEntry | undefined {
  return SEGUNDA_SEASONS.find((s) => s.temporada === temporada);
}
