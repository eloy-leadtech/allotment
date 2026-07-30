import estadios from './db/estadios.json';

/** A club's stadium (name and capacity). */
export interface Estadio {
  nombre: string;
  aforo: number | null;
}

const MAP = estadios as Record<string, Estadio>;

/** The stadium for a team id, if we have committed data for it. */
export function getEstadio(teamId: string): Estadio | undefined {
  return MAP[teamId];
}
