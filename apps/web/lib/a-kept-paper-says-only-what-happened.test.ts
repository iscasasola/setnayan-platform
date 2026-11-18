/**
 * W1-B41 · W1-B42 (live walk, 18 Nov 2026).
 *  · B41 — Admin › Verify said "Typed by the supplier after 3 tries" on a paper nobody had typed into (every send had
 *    failed, B37). "Typed" is said only when the supplier's values are on file; otherwise the paper reads as kept.
 *  · B42 — three failed sends stacked three identical errors over the bottom nav and the "Get verified" row. The same
 *    words now replace the earlier toast instead of stacking.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

test('B41 · "Typed by the supplier" is said only when typed values exist', () => {
  const admin = stripComments(readFileSync(join(WEB, 'app/admin/verify/page.tsx'), 'utf8'));
  // The banner: typed only when some kept paper has values.
  assert.match(
    admin,
    /kept\.some\(\(t\) => Object\.keys\(t\.values\)\.length > 0\)\s*\?\s*'Typed by the supplier after 3 tries\.[^']*'\s*:\s*'Kept after 3 unreadable tries — nothing typed\.[^']*'/,
  );
  // The per-paper card: the same rule.
  assert.match(admin, /Object\.keys\(typed\.values\)\.length > 0 \? \(\s*<>Typed by the supplier · Try/);
  assert.match(admin, /<>Kept after 3 unreadable tries · Try/);
});

test('B42 · the same toast words replace the earlier copy, never stack', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/toast/toast-provider.tsx'), 'utf8'));
  assert.match(src, /list\.filter\(\(t\) => t\.variant !== variant \|\| t\.message !== message\), \{ id, variant, message \}/);
});
