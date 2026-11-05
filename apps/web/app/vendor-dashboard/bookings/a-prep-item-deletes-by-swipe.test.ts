/**
 * a-prep-item-deletes-by-swipe.test.ts — 👈 a supplier's prep-schedule item on Bookings deletes by its SWIPE, not a
 * visible trash (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"),
 * with Undo, through the same `vendorDeletePreparationItem`; the page mounts the one Undo toast once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const prep = read('_components/vendor-prep-add.tsx');
const surface = read('surface.tsx');

test('each prep item is the one SwipeToDelete, named for its item — the trash button is gone', () => {
  assert.match(prep, /<SwipeToDelete[\s\S]{0,200}?label=\{`Remove \$\{it\.label\}`\}/);
  assert.doesNotMatch(prep, /VendorDeletePrepItem|aria-label=\{`Remove \$\{label\}`\}/);
});

test('the swipe deletes with Undo through the same action, and the page has one Undo toast', () => {
  assert.match(prep, /deleteWithUndo\(\{[\s\S]{0,600}?commit: \(\) => vendorDeletePreparationItem\(fd\)/);
  assert.doesNotMatch(prep, /<UndoToastHost/, 'one per booking would stack toasts — the page mounts it');
  assert.equal((surface.match(/<UndoToastHost \/>/g) ?? []).length, 1);
});
