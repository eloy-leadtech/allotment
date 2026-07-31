import type { League } from './schemas';
import {
  loadPrimera9394,
  loadPrimera9495,
  loadPrimera9596,
  loadPrimera9697,
  loadPrimera9798,
  loadPrimera9899,
  loadSegunda9495,
  loadSegunda9596,
  loadSegunda9697,
  loadSegunda9798,
  loadSegunda9899,
  loadSegunda9900,
  loadEuropa9899,
  loadEuropa9900,
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
 * Registry of available seasons, oldest first. Extensible: adding a season =
 * adding an entry (and its committed JSON), no engine changes. The career can
 * start at the oldest (93/94) and chains forward:
 * 93/94 → 94/95 → 95/96 → 96/97 → 97/98 → 98/99.
 */
export const SEASONS: readonly SeasonEntry[] = [
  { id: 'es-primera-9394', nombre: 'Liga española 93/94 (atributos aprox.)', temporada: '93/94', load: loadPrimera9394 },
  { id: 'es-primera-9495', nombre: 'Liga española 94/95 (atributos aprox.)', temporada: '94/95', load: loadPrimera9495 },
  { id: 'es-primera-9596', nombre: 'Liga española 95/96 (atributos aprox.)', temporada: '95/96', load: loadPrimera9596 },
  { id: 'es-primera-9697', nombre: 'Liga española 96/97', temporada: '96/97', load: loadPrimera9697 },
  { id: 'es-primera-9798', nombre: 'Liga española 97/98', temporada: '97/98', load: loadPrimera9798 },
  { id: 'es-primera-9899', nombre: 'Liga española 98/99', temporada: '98/99', load: loadPrimera9899 },
];

export function getSeason(id: string): SeasonEntry | undefined {
  return SEASONS.find((s) => s.id === id);
}

/** The Primera season for a given season label, if one exists. */
export function getSeasonByTemporada(temporada: string): SeasonEntry | undefined {
  return SEASONS.find((s) => s.temporada === temporada);
}

/**
 * Segunda División databases, keyed like SEASONS. Coverage varies by season
 * (96/97 and 97/98 are partial — 10 clubs — from the classic pack; 98/99 and
 * 99/00 are complete). The two-division career pairs each Primera season with
 * its Segunda by `temporada`.
 */
export const SEGUNDA_SEASONS: readonly SeasonEntry[] = [
  { id: 'es-segunda-9495', nombre: 'Segunda 94/95', temporada: '94/95', load: loadSegunda9495 },
  { id: 'es-segunda-9596', nombre: 'Segunda 95/96', temporada: '95/96', load: loadSegunda9596 },
  { id: 'es-segunda-9697', nombre: 'Segunda 96/97', temporada: '96/97', load: loadSegunda9697 },
  { id: 'es-segunda-9798', nombre: 'Segunda 97/98', temporada: '97/98', load: loadSegunda9798 },
  { id: 'es-segunda-9899', nombre: 'Segunda 98/99', temporada: '98/99', load: loadSegunda9899 },
  { id: 'es-segunda-9900', nombre: 'Segunda 99/00', temporada: '99/00', load: loadSegunda9900 },
];

/** The Segunda database for a given season label, if one exists. */
export function getSegundaByTemporada(temporada: string): SeasonEntry | undefined {
  return SEGUNDA_SEASONS.find((s) => s.temporada === temporada);
}

/**
 * European club databases (top clubs per season, from the late FDI packs). Not
 * playable leagues — squad containers that feed the European competition
 * (Champions/UEFA). Paired to a career season by `temporada`.
 */
export const EUROPA_SEASONS: readonly SeasonEntry[] = [
  { id: 'europa-9899', nombre: 'Clubes de Europa 98/99', temporada: '98/99', load: loadEuropa9899 },
  { id: 'europa-9900', nombre: 'Clubes de Europa 99/00', temporada: '99/00', load: loadEuropa9900 },
];

/** The European clubs database for a given season label, if one exists. */
export function getEuropaByTemporada(temporada: string): SeasonEntry | undefined {
  return EUROPA_SEASONS.find((s) => s.temporada === temporada);
}

/** The Primera season that follows a given season label, if any. */
export function nextSeasonByTemporada(temporada: string): SeasonEntry | undefined {
  const idx = SEASONS.findIndex((s) => s.temporada === temporada);
  return idx < 0 ? undefined : SEASONS[idx + 1];
}
