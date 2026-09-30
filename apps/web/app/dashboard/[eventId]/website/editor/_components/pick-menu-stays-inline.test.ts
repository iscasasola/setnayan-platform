import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 🪤 A COMMENT CAN COST EVERY PAGE BYTES (Fix E, 2026-09-30, measured with
 * three production builds). `PickMenu` is imported by dozens of route chunks.
 * Webpack inlines a shared module into each of them until its TRANSFORMED size
 * crosses `splitChunks.minSize` (20,000 bytes — comments count); past it, the
 * module becomes its own lazily-loaded chunk, and every such chunk is one more
 * entry in the webpack runtime that EVERY page downloads. `pick-menu.tsx` at
 * 14,811 bytes of source split (shared bundle over its 202KB ceiling); the same
 * file with its notes moved to the type-only `pick-menu-types.ts` inlined again
 * and the shared bundle measured back at main's figure. main inlined it at
 * 13,096 bytes.
 *
 * So: types and notes grow in `pick-menu-types.ts` (erased from the bundle);
 * `pick-menu.tsx` stays behaviour, under the line main was under.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PICK = join(HERE, 'pick-menu.tsx');

test('pick-menu.tsx stays under the size main inlined at', () => {
  const bytes = statSync(PICK).size;
  assert.ok(
    bytes <= 13_000,
    `pick-menu.tsx is ${bytes} bytes. Past ~14.8K it is split into its own chunk and the every-page webpack ` +
      'runtime grows. Move types and notes into pick-menu-types.ts (type-only, erased) before adding here.',
  );
});

test('the types live in a type-only module — nothing there can reach the bundle', () => {
  const types = readFileSync(join(HERE, 'pick-menu-types.ts'), 'utf8');
  for (const line of types.split('\n')) {
    assert.ok(!/^export (const|let|function|class|default)\b/.test(line), `pick-menu-types.ts exports a value: ${line}`);
  }
  assert.match(readFileSync(PICK, 'utf8'), /^import type \{ PickMenuProps, PickOption \} from '\.\/pick-menu-types';$/m);
});
