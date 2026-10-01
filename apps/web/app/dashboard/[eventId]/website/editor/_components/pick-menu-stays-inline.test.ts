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
 * entry in the webpack runtime that EVERY page downloads. The line is NOT a
 * clean number — which candidate chunks webpack keeps also depends on its
 * request caps — so it was measured, with CI's env, on this branch:
 *   · pick-menu.tsx at 14,811 bytes → split, shared bundle 206,847–206,850 B
 *   · types + top notes moved out, 10,918 bytes → STILL split, 206,848 B
 *   · every comment out, 9,920 bytes → inlined, 206,831 B
 * The ceiling is 206,848 B. So the guard sits under the size that inlined.
 * So: types and notes grow in `pick-menu-types.ts` (erased from the bundle);
 * `pick-menu.tsx` stays behaviour, under the line main was under.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PICK = join(HERE, 'pick-menu.tsx');

test('pick-menu.tsx stays under the size that measured inlined', () => {
  const bytes = statSync(PICK).size;
  assert.ok(
    bytes <= 9_800,
    `pick-menu.tsx is ${bytes} bytes. At 10.9K it was still split into its own chunk and the every-page webpack ` +
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
