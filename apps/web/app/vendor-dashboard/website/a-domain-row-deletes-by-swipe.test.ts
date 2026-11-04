/**
 * a-domain-row-deletes-by-swipe.test.ts — 👈 a custom-domain row's delete is its SWIPE, not a visible trash
 * (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), and it still
 * reaches the one `removeVendorDomain` — after the Undo window (`deleteWithUndo`), never at once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '_domain-manager.tsx'), 'utf8'));

test('the domain row is wrapped in the one SwipeToDelete, named for its domain', () => {
  assert.match(src, /<SwipeToDelete[\s\S]{0,200}?label=\{`Remove \$\{d\.domain\}`\}/);
  assert.doesNotMatch(src, /aria-label=\{`Remove \$\{d\.domain\}`\}/, 'the visible trash left the row');
});

test('the swipe deletes with Undo and commits through removeVendorDomain', () => {
  assert.match(src, /onDelete=\{\(\) => handleRemove\(d\)\}/);
  assert.match(src, /deleteWithUndo\(\{[\s\S]{0,900}?commit: \(\) => removeVendorDomain\(d\.domain_id\)/);
  assert.match(src, /<UndoToastHost \/>/, 'the Undo toast is mounted');
});
