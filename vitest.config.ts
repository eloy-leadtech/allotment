import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Engine/game/data run in a fast Node environment; UI/app in jsdom.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      // Never scan node_modules, the build output, or agent worktrees under .claude.
      exclude: ['**/node_modules/**', 'dist/**', '.claude/**'],
      environment: 'node',
      environmentMatchGlobs: [
        ['ui/**', 'jsdom'],
        ['app/**', 'jsdom'],
      ],
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
