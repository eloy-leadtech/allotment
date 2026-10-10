import type { Screen } from '@app/navigation';

/** One section button in the office tower. Icon names map to the sprite (#ic-<icon>). */
export interface TowerItem {
  icon: string;
  label: string;
  /** Destination screen (every Slice-1 section routes to an existing screen). */
  to: Screen;
}

/** One labelled group of section buttons. */
export interface TowerGroup {
  heading: string;
  items: TowerItem[];
}

/**
 * The single left tower of the despacho, ported 1:1 from the mockup (`body.html`):
 * three groups, the same icons (including the mockup's reuse of ic-clasificacion
 * for Estadio and ic-prensa for Personal). Each button navigates to the matching
 * existing screen; the section contents move inside the office in later slices.
 */
export const TOWER: readonly TowerGroup[] = [
  {
    heading: 'Terreno de juego',
    items: [
      { icon: 'alineacion', label: 'Alineación', to: 'squad' },
      { icon: 'tactica', label: 'Táctica', to: 'tactics' },
      { icon: 'clasificacion', label: 'Clasificación', to: 'standings' },
    ],
  },
  {
    heading: 'Club',
    items: [
      { icon: 'directiva', label: 'Directiva', to: 'directiva' },
      { icon: 'fichajes', label: 'Fichajes', to: 'market' },
      { icon: 'prensa', label: 'Personal', to: 'staff' },
    ],
  },
  {
    heading: 'La semana',
    items: [
      { icon: 'finanzas', label: 'Finanzas', to: 'sponsors' },
      { icon: 'clasificacion', label: 'Estadio', to: 'stadium' },
      { icon: 'prensa', label: 'Prensa', to: 'press' },
    ],
  },
];
