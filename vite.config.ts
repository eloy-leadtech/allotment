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
function catalogDataPlugin(): Plugin {
  const dir = process.env.VITE_DATA_DIR;
  return {
    name: 'pcf-catalog-data',
    configureServer(server) {
      if (!dir) {
        server.config.logger.warn(
          '[catalogo] VITE_DATA_DIR no definido: /catalogo/ no servirá datos. ' +
            'Apúntalo a la carpeta game/ del catálogo para jugar temporadas nuevas.',
        );
        return;
      }
      const rootDir: string = dir;
      server.middlewares.use('/catalogo', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0] ?? ''));
        if (rel.includes('..')) {
          res.statusCode = 403;
          return res.end('forbidden');
        }
        const file = join(rootDir, rel);
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (rel.endsWith('.json')) {
            res.statusCode = 404;
            return res.end('not found');
          }
          return next();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(file).pipe(res);
      });
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
