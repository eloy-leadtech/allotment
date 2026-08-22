import { useEffect, useState } from 'react';

/**
 * Where the portrait images live (must end in `/`). Defaults to the standalone
 * `pcfutbol-fotos` repo served by GitHub Pages, so fichas show real photos both
 * in local dev and on the deployed web. When we package the native
 * Windows/Android app, set `VITE_PHOTO_BASE` to a bundled local folder so it
 * reads images off disk instead of hitting the network.
 */
const PHOTO_BASE =
  (import.meta.env.VITE_PHOTO_BASE as string | undefined) ??
  'https://eloy-leadtech.github.io/pcfutbol-fotos/';

/** One player's photo record from the ficha-photo map. */
export interface FichaPhotoEntry {
  /** BDFutbol player id; also the folder holding the images. */
  bdf_id: string;
  /** Image filenames verified on disk, e.g. `["119.jpg", "119b.jpg"]`. */
  fotos: string[];
  /** How the match was made (short-exact, full-exact, …). */
  metodo: string;
}

/** temporada ("96/97") -> game player id -> photo record. */
type FichaPhotoMap = Record<string, Record<string, FichaPhotoEntry>>;

/**
 * The map lives in `public/ficha-photo-map.json` (~1.4MB) and is fetched once for
 * the whole app; this module-level promise dedupes concurrent callers and caches
 * the result across every screen that asks for it.
 */
let mapPromise: Promise<FichaPhotoMap> | null = null;

function loadFichaPhotoMap(): Promise<FichaPhotoMap> {
  if (!mapPromise) {
    const url = `${import.meta.env.BASE_URL}ficha-photo-map.json`;
    mapPromise = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<FichaPhotoMap>) : {}))
      .catch(() => ({}));
  }
  return mapPromise;
}

/** A resolved player photo: a ready-to-use `src` plus the underlying record. */
export interface FichaPhoto {
  src: string;
  entry: FichaPhotoEntry;
}

/**
 * Resolve the real BDFutbol portrait for a player in a given season, or `null`
 * when there is no high-confidence match (the caller keeps its silhouette
 * fallback). The `__meta__` key in the map is never a season, so a normal lookup
 * by `temporada` can never collide with it.
 */
export function useFichaPhoto(temporada: string, playerId: string | null): FichaPhoto | null {
  const [map, setMap] = useState<FichaPhotoMap | null>(null);

  useEffect(() => {
    let alive = true;
    void loadFichaPhotoMap().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!map || !playerId) return null;
  const entry = map[temporada]?.[playerId];
  const file = entry?.fotos[0];
  if (!entry || !file) return null;
  return { src: `${PHOTO_BASE}${entry.bdf_id}/${file}`, entry };
}
