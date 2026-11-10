/**
 * a-saved-paper-removes-by-swipe.test.ts — 👈 STEP 5's SAVED PAPER SWIPES LEFT TO REMOVE, WITH UNDO (Build 5 item T,
 * house template T14 "Rows: tap opens, swipe left removes + Undo"; owner 2026-11-03 DECISION_LOG "SWIPE LEFT TO DELETE
 * ON EVERY LIST ROW"; approved prototype `open-shop-redesign-v21.html` `docRow`, whose saved row carries
 * `data-swipe="doc:…"`).
 *
 *   1 · the saved row is the ONE `SwipeToDelete`, named for its paper; the empty row (Add) has no swipe.
 *   2 · the swipe and the Remove inside the preview are ONE remove — `deleteWithUndo`, never an at-once `save('')`.
 *   3 · the remove writes through the same queued `updateDocUploadInline` with an empty ref, after the Undo window.
 *   4 · a file picked inside the window writes the waiting remove FIRST (`flush`), so the late remove can never wipe it.
 *   5 · the one Undo toast is mounted by the papers list, not once per row.
 *
 * SABOTAGE (seen RED, then restored, 2026-11-10): Remove back to `onClick={() => save('')}` → 2 red · the
 * `flush()` in `onFilePicked` dropped → 4 red · the list's `<UndoToastHost />` dropped → 5 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(join(HERE, 'setup-papers.tsx'), 'utf8'));
const rowStart = src.indexOf('function PaperRow(');
const list = src.slice(0, rowStart);
const row = src.slice(rowStart);

test('1 · the saved paper row is the one SwipeToDelete, named for its paper — the empty row has no swipe', () => {
  assert.match(src, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete';/);
  assert.match(row, /\{hasFile \? \(\s*<SwipeToDelete label=\{`Remove \$\{p\.label\}`\} word="Remove" onDelete=\{remove\}/);
  assert.equal((row.match(/<SwipeToDelete\b/g) ?? []).length, 1, 'one swipe per paper row');
  const empty = row.slice(row.indexOf(') : (', row.indexOf('<SwipeToDelete')));
  assert.match(empty, /label="Add"/, 'the empty row still adds in one tap');
});

test('2 · the swipe and the Remove in the preview are ONE remove, with Undo — never an at-once save of an empty ref', () => {
  assert.match(row, /tone="danger" icon=\{<Trash2 [^\n]*?\/>\} label="Remove" onClick=\{remove\}/);
  assert.doesNotMatch(row, /save\(''\)/, 'a Remove that writes at once has no Undo');
  assert.match(row, /const handle = deleteWithUndo\(\{\s*label: `\$\{p\.label\} removed`,\s*hide: \(\) => setRemoved\(true\),\s*restore: \(\) => setRemoved\(false\),/);
  assert.match(row, /const hasFile = p\.editable && !removed && \(p\.ref != null \|\| local != null\);/, 'a removed paper must read as empty at once');
});

test('3 · the remove is written through the same queued save, with an empty ref', () => {
  const commit = row.slice(row.indexOf('const remove = () => {'), row.indexOf('const pick = () => {'));
  assert.match(commit, /fd\.set\('r2_ref', ''\);/);
  assert.match(commit, /const run = queue\.then\(\(\) => updateDocUploadInline\(null, fd\)\);\s*queue = run\.catch\(\(\) => undefined\);/);
});

test('4 · a new file picked inside the Undo window writes the waiting remove first', () => {
  assert.match(row, /onFilePicked=\{\(f\) => \{\s*void pendingRemove\.current\?\.flush\(\);\s*pendingRemove\.current = null;\s*setRemoved\(false\);/);
});

test('5 · one Undo toast, mounted by the papers list — not once per row', () => {
  assert.equal((list.match(/<UndoToastHost \/>/g) ?? []).length, 1);
  assert.doesNotMatch(row, /<UndoToastHost/);
});
