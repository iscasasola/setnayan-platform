/**
 * the-pick-row-deletes-by-its-swipe.test.ts — 👈 A PLAYLIST PICK'S DELETE IS ITS SWIPE, WITH UNDO (owner 2026-11-03,
 * DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS").
 *
 * The row draws no trash of its own; it is wrapped in the ONE swipe (`app/_components/swipe-to-delete.tsx`), and the
 * swipe's Delete reaches the SAME server action the old trash posted (`deletePlaylistPick`), through `deleteWithUndo`
 * so the toast offers Undo and nothing is written until its window closes. The page mounts the one Undo toast host.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const row = stripComments(readFileSync(join(HERE, 'playlist-pick-row.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

test('the pick row draws no visible delete — its delete is the swipe, named for the song', () => {
  assert.doesNotMatch(row, /aria-label=\{`(?:Remove|Delete)/, 'a visible Remove/Delete came back onto the pick row');
  assert.doesNotMatch(row, /\bTrash2\b/, 'the row draws its own trash again');
  assert.match(row, /<SwipeToDelete[\s\S]{0,200}label=\{`Remove \$\{pick\.song_label\}`\}[\s\S]{0,200}onDelete=\{handleDelete\}/);
});

test('the swipe reaches the same server action, through Undo', () => {
  const at = row.indexOf('function handleDelete');
  assert.ok(at > 0, 'handleDelete is gone');
  const fn = row.slice(at, row.indexOf('const rowTint', at));
  assert.match(fn, /deleteWithUndo\(\{/);
  assert.match(fn, /hide:\s*\(\)\s*=>\s*setHidden\(true\)/);
  assert.match(fn, /restore:\s*\(\)\s*=>\s*setHidden\(false\)/);
  assert.match(fn, /await deletePlaylistPick\(formData\)/);
  assert.match(page, /<UndoToastHost \/>/, 'the playlist page must mount the one Undo toast host');
});
