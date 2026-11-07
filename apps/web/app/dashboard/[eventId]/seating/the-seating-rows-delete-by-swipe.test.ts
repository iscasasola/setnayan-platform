/**
 * 👈 THE SEATING ROWS DELETE BY THEIR SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW —
 * NO VISIBLE ✕ ON ROWS") — each swipe reaches the SAME handler its ✕ / Remove used to, with Undo:
 *
 *   · a seated guest's row (seat list)  → `onRemove` → the editor's `unseat`, whose Undo re-seats on the same chair
 *   · a table's row (both lists)        → `requestRemoveUnit` (asks when people sit there) → `removeTables` (Undo)
 *   · a keep-apart rule's row           → `removeKeepApart` (Undo)
 *   · a walkthrough zone's card         → the same "lose the walk video" ask, then `deleteWalkthroughZone` (Undo)
 *
 * And the seat list's press-and-hold DRAG is untouched: a row still carries `data-seat-drag`, and the swipe lets go of
 * a finger held still (`SWIPE_HOLD_MS` = the list's own `HOLD_MS`, 300 ms).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SWIPE_HOLD_MS } from '@/app/_components/swipe-to-delete';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · a seated guest: no red Remove — the row is the swipe, the same onRemove; the drag still lifts on a hold', () => {
  const list = read('_components/seat-list.tsx');
  assert.doesNotMatch(list, /data-testid="seat-row-remove"/);
  assert.match(list, /<SwipeToDelete\s+key=\{key\}\s+label=\{`Remove \$\{g\.name\} from the seat`\}[\s\S]*?onRemove\(g\.id\);/);
  assert.match(list, /data-seat-drag=\{canEdit \? g\.id : undefined\}/, 'the row lost its drag');
  assert.equal(Number(/const HOLD_MS = (\d+);/.exec(list)?.[1]), SWIPE_HOLD_MS, 'the swipe and the drag no longer agree on a hold');
  const ed = read('_components/seating-editor.tsx');
  assert.match(ed, /const unseat = [\s\S]*?pushUndo\(\{[\s\S]*?back\.set\('table_id', tableId\);[\s\S]*?assignGuest\(back\)/, 'unseat has no Undo back to the chair');
});

test('2 · a table and a rule: their rows are the swipe — the same ask, then Undo', () => {
  const ed = read('_components/seating-editor.tsx');
  assert.equal((ed.match(/label=\{`Delete \$\{u\.label\}`\}[\s\S]{0,400}?requestRemoveUnit\(u\);/g) ?? []).length, 2, 'both table lists swipe to the same ask');
  assert.doesNotMatch(ed, /aria-label=\{`Delete \$\{u\.label\}`\}/);
  assert.doesNotMatch(ed, /aria-label="Remove keep-apart rule"/);
  assert.match(ed, /onDelete=\{\(\) => removeKeepApart\(r\)\}/);
  assert.match(ed, /const removeKeepApart = [\s\S]*?deleteWithUndo\(/);
  assert.match(ed, /<UndoToastHost \/>/);
});

test('3 · a walkthrough zone: the card is the swipe — the same ask, then Undo', () => {
  const wm = read('walkthrough/_components/walkthrough-manager.tsx');
  assert.doesNotMatch(wm, /aria-label=\{`Delete \$\{zone\.label\}`\}/);
  assert.match(wm, /if \(!confirm\(`Delete “\$\{zone\.label\}”\? Its tables keep their seats — they just lose the walk video\.`\)\) return close\(\);\s*deleteWithUndo\(\{[\s\S]*?commit: \(\) => deleteWalkthroughZone\(eventId, zone\.zoneId\)/);
});
