import { useEffect, useState } from 'react';
import {
  indexarNoticias,
  temporadaLarga,
  type CalendarioPrensa,
  type IndicePrensa,
  type Noticia,
  type SuplementoTemporada,
} from '@game';

/**
 * Dónde viven las fotos del periódico (tiene que acabar en `/`). Por defecto se
 * sirven desde `public/prensa/fotos/`, que es lo que hay en local y en la web.
 * Para el empaquetado nativo basta apuntar `VITE_PRENSA_BASE` a una carpeta del
 * disco, igual que se hace con los retratos de los jugadores.
 */
const FOTO_BASE =
  (import.meta.env.VITE_PRENSA_BASE as string | undefined) ??
  `${import.meta.env.BASE_URL}prensa/fotos/`;

/** Crédito de una imagen: obligatorio publicarlo en las CC BY y CC BY-SA. */
export interface CreditoImagen {
  id: string;
  foto: string;
  licencia: string;
  autor: string;
  fuente: string;
}

/** Todo lo que necesita la pantalla del diario, ya cargado y listo. */
export interface Prensa {
  indice: IndicePrensa;
  calendario: CalendarioPrensa;
  creditos: ReadonlyMap<string, CreditoImagen>;
  total: number;
}

/** `noticias.json` pesa ~760 KB: se pide una vez y se comparte entre pantallas. */
let promesa: Promise<Prensa> | null = null;

const VACIA: Prensa = {
  indice: new Map(),
  calendario: {},
  creditos: new Map(),
  total: 0,
};

async function pedirJson<T>(fichero: string, porDefecto: T): Promise<T> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}prensa/${fichero}`);
    return res.ok ? ((await res.json()) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function cargarPrensa(): Promise<Prensa> {
  if (!promesa) {
    promesa = Promise.all([
      pedirJson<{ eventos?: Noticia[] }>('noticias.json', {}),
      pedirJson<CalendarioPrensa>('calendario.json', {}),
      pedirJson<{ imagenes?: CreditoImagen[] }>('creditos.json', {}),
    ]).then(([noticias, calendario, creditos]) => {
      const eventos = noticias.eventos ?? [];
      return {
        indice: indexarNoticias(eventos),
        calendario,
        creditos: new Map((creditos.imagenes ?? []).map((c) => [c.id, c])),
        total: eventos.length,
      };
    });
  }
  return promesa;
}

/** Carga perezosa del almanaque. Devuelve `null` mientras llega. */
export function usePrensa(): Prensa | null {
  const [prensa, setPrensa] = useState<Prensa | null>(null);

  useEffect(() => {
    let vivo = true;
    void cargarPrensa().then((p) => {
      if (vivo) setPrensa(p);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return prensa;
}

/** URL lista para un `<img>` a partir del nombre de fichero de la noticia. */
export function urlFoto(foto: string): string {
  return `${FOTO_BASE}${foto}`;
}

/** Solo para los tests: olvida lo ya cargado. */
export function _resetPrensa(): void {
  promesa = null;
}

export { VACIA as PRENSA_VACIA };

/**
 * El suplemento deportivo de una temporada: los hechos reales de cada semana.
 * Es un fichero por temporada (~60 KB) y solo se pide el de la que se juega.
 */
const suplementos = new Map<string, Promise<SuplementoTemporada | null>>();

function cargarSuplemento(temporada: string): Promise<SuplementoTemporada | null> {
  const larga = temporadaLarga(temporada);
  if (!larga) return Promise.resolve(null);
  let p = suplementos.get(larga);
  if (!p) {
    p = pedirJson<SuplementoTemporada | null>(`semanal/${larga}.json`, null);
    suplementos.set(larga, p);
  }
  return p;
}

/** Carga perezosa del suplemento de una temporada. `null` mientras llega. */
export function useSuplemento(temporada: string | null): SuplementoTemporada | null {
  const [dato, setDato] = useState<SuplementoTemporada | null>(null);

  useEffect(() => {
    if (!temporada) return undefined;
    let vivo = true;
    void cargarSuplemento(temporada).then((s) => {
      if (vivo) setDato(s);
    });
    return () => {
      vivo = false;
    };
  }, [temporada]);

  return dato;
}
