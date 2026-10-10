import { useEffect, useState } from 'react';

/**
 * Curiosities of the NEXT rival for the despacho ticker. The data (one array of
 * facts per team slug) lives as a static asset under public/, mirroring the lab
 * mockup's `RIVAL_FACTS`; it is flavour text, not simulation input, so it is
 * fetched at runtime rather than bundled or Zod-validated.
 */
export type RivalFacts = Readonly<Record<string, readonly string[]>>;

/**
 * Readable rival name with its Spanish article, for the ticker tag
 * ("¿Sabías que… el Celta?"). Ported verbatim from the mockup's `NOMBRE` map;
 * teams without an entry fall back to their plain club name.
 */
export const RIVAL_ARTICLE: Readonly<Record<string, string>> = {
  zaragoza: 'el Zaragoza', bologna: 'el Bolonia', vejle: 'el Vejle', willemii: 'el Willem II',
  valencia: 'el Valencia', manchester: 'el Man. United', realsociedad: 'la Real',
  barcelona: 'el Barça', realmadrid: 'el Madrid', atletico: 'el Atleti', athletic: 'el Athletic',
  betis: 'el Betis', deportivo: 'el Dépor', celta: 'el Celta', espanyol: 'el Espanyol',
  mallorca: 'el Mallorca', alaves: 'el Alavés', oviedo: 'el Oviedo', valladolid: 'el Valladolid',
  racing: 'el Racing', tenerife: 'el Tenerife', villarreal: 'el Villarreal',
  salamanca: 'el Salamanca', extremadura: 'el Extremadura',
};

/** The ticker tag line for a rival ("¿Sabías que… el Celta?"). */
export function rivalTag(slug: string, fallbackName: string): string {
  const name = RIVAL_ARTICLE[slug] ?? fallbackName;
  return name ? `¿Sabías que… ${name}?` : '¿Sabías que…?';
}

/**
 * Load the rival-facts asset once. Returns an empty map until it resolves (and if
 * it ever fails, e.g. outside the browser), so callers degrade to a neutral
 * ticker rather than throwing.
 */
export function useRivalFacts(): RivalFacts {
  const [facts, setFacts] = useState<RivalFacts>({});
  useEffect(() => {
    if (typeof fetch !== 'function') return; // non-browser (tests): neutral ticker
    let alive = true;
    const url = `${import.meta.env.BASE_URL}ui/mister/facts_es.json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: unknown) => {
        if (alive && data && typeof data === 'object') setFacts(data as RivalFacts);
      })
      .catch(() => {
        /* offline/test: keep the empty map, the ticker shows a neutral line */
      });
    return () => {
      alive = false;
    };
  }, []);
  return facts;
}
