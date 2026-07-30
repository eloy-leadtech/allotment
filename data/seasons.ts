import type { League } from './schemas';
import { loadPrimera9697 } from './loader';

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
];

export function getSeason(id: string): SeasonEntry | undefined {
  return SEASONS.find((s) => s.id === id);
}
