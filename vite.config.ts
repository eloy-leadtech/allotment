import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the historical catalogue (284 MB of season JSON) from a local folder
 * given in VITE_DATA_DIR, mounted at /catalogo/. Keeps the data out of the repo
 * and out of the bundle while the game fetches only the leagues it opens.
 */
type ServerLike = { middlewares: { use: (path: string, fn: MiddlewareFn) => void } };
type MiddlewareFn = (
  req: { url?: string },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s?: string) => void },
  next: () => void,
) => void;

/** Mount a local folder at `mount`, serving its files with `contentType`. */
function mountStatic(server: ServerLike, mount: string, dir: string, contentType: string): void {
  server.middlewares.use(mount, (req, res) => {
    const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0] ?? ''));
    if (rel.includes('..')) {
      res.statusCode = 403;
      return res.end('forbidden');
    }
    const file = join(dir, rel);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.setHeader('Content-Type', contentType);
    createReadStream(file).pipe(res as unknown as NodeJS.WritableStream);
  });
}

/**
 * Serves the historical catalogue (season JSON in VITE_DATA_DIR at /catalogo/)
 * and the BDFutbol player photos (VITE_PHOTO_DIR at /fotos-bdf/). Keeps the
 * ~284 MB of data and ~3 GB of photos out of the repo and out of the bundle
 * while the game fetches only what it opens.
 */
function catalogDataPlugin(): Plugin {
  const dataDir = process.env.VITE_DATA_DIR;
  const photoDir = process.env.VITE_PHOTO_DIR;
  return {
    name: 'pcf-catalog-data',
    configureServer(server) {
      if (dataDir) mountStatic(server, '/catalogo', dataDir, 'application/json; charset=utf-8');
      else
        server.config.logger.warn(
          '[catalogo] VITE_DATA_DIR no definido: /catalogo/ no servirá datos.',
        );
      if (photoDir) mountStatic(server, '/fotos-bdf', photoDir, 'image/jpeg');
      else
        server.config.logger.warn(
          '[fotos] VITE_PHOTO_DIR no definido: /fotos-bdf/ no servirá fotos de jugador.',
        );
    },
  };
}

// `base` is read from VITE_BASE so GitHub Pages can serve the game from a
// subdirectory (e.g. /allotment/). Defaults to '/' for local dev.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), catalogDataPlugin()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./engine', import.meta.url)),
      '@game': fileURLToPath(new URL('./game', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@ui': fileURLToPath(new URL('./ui', import.meta.url)),
      '@app': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
