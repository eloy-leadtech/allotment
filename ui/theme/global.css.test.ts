import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * `global.css` pulls the design tokens and the PC Fútbol 7 calco skin in with
 * `@import`. CSS only honours `@import` when it precedes every other statement,
 * so an import that drifts down the file is silently IGNORED: the calco markup
 * then renders completely unstyled while the build stays green. That is exactly
 * how the skin was lost once during a merge, so it is pinned here.
 */
// Read off the repo root: the test runs under jsdom, where import.meta.url is
// an http URL that node:url cannot turn back into a path.
const css = readFileSync(join(process.cwd(), 'ui/theme/global.css'), 'utf8');

/** Statements that may legally precede an `@import` (plus blank lines/comments). */
const ALLOWED_BEFORE = /^\s*(@charset\b|@layer\s+[^{]*;|\/\*[\s\S]*?\*\/)?\s*$/;

describe('global.css', () => {
  it('imports the tokens, the PCF7 calco skin and the Mister skin', () => {
    expect(css).toMatch(/@import\s+'\.\/tokens\.css';/);
    expect(css).toMatch(/@import\s+'\.\/pcf7-calco\.css';/);
    expect(css).toMatch(/@import\s+'\.\/mister\.css';/);
  });

  it('keeps every @import ahead of the first rule, or the browser drops it', () => {
    const lines = css.split('\n');
    const lastImport = lines.reduce((last, l, i) => (l.trimStart().startsWith('@import') ? i : last), -1);
    // Nothing but comments/@charset/@layer may sit above the last @import.
    const offenders = lines
      .slice(0, lastImport)
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('@import') && !ALLOWED_BEFORE.test(line));
    expect(offenders).toEqual([]);
  });
});
