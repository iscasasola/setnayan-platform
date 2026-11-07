/**
 * swipe-to-delete.test.ts — THE ONE SWIPE's rules, executed (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST ROW").
 *
 *   1. a vertical move first is the list's scroll — the row never moves;
 *   2. a left move past 8 px is ours; the row follows, never past the Delete's width, never right of rest;
 *   3. it snaps open past halfway, closed short of it;
 *   4. the tap a drag ends in is swallowed and a tap on an open row closes it (source: `onClickCapture`);
 *   5. EVERY delete keeps Undo: hidden at once, written only after the window; Undo writes nothing; a refused write
 *      brings the row back; leaving the page writes it then.
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): the vertical early-out removed → 1 red · `swipeSettle` threshold at
 * the full width → 3 red · the timer in `deleteWithUndo` writing at once → 5 red ·
 * the one-host gate in `UndoToastHost` dropped → 4b red · the closed row's `invisible` red dropped → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SWIPE_HOLD_MS, SWIPE_REVEAL_PX, swipeBegin, swipeMove, swipeSettle } from './swipe-to-delete';
import { deleteWithUndo, pendingDeleteCount } from './undo/delete-with-undo';
import { getUndoToast, runUndo, dismissUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'swipe-to-delete.tsx'), 'utf8'));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('1 · a vertical move first is the scroll — the gesture lets go and the row stays', () => {
  const d = swipeBegin(200, 300, 0);
  const r = swipeMove(d, 195, 330);
  assert.equal(r.drag.active, false);
  assert.equal(r.tx, null);
});

test('1b · a finger held still first is the row’s own hold (guests’ role drag) — the swipe lets go', () => {
  const d = swipeBegin(300, 300, 0, 1000);
  const r = swipeMove(d, 250, 300, 1000 + SWIPE_HOLD_MS + 1);
  assert.equal(r.drag.active, false);
  assert.equal(r.tx, null);
  assert.equal(swipeMove(d, 250, 300, 1000 + 50).tx, -50, 'a quick swipe is still a swipe');
});

test('2 · a left move is ours — clamped to the Delete’s width, never right of rest', () => {
  let d = swipeBegin(300, 300, 0);
  const small = swipeMove(d, 295, 301);
  assert.equal(small.tx, null, 'under 8 px nothing decides');
  const left = swipeMove(d, 260, 302);
  assert.equal(left.drag.horiz, true);
  assert.equal(left.tx, -40);
  d = left.drag;
  assert.equal(swipeMove(d, 0, 300).tx, -SWIPE_REVEAL_PX);
  assert.equal(swipeMove(d, 400, 300).tx, 0);
});

test('3 · past halfway it snaps open, short of it closed', () => {
  assert.equal(swipeSettle(-SWIPE_REVEAL_PX / 2 - 1), -SWIPE_REVEAL_PX);
  assert.equal(swipeSettle(-SWIPE_REVEAL_PX / 2 + 1), 0);
  assert.equal(swipeSettle(0), 0);
});

test('4 · a drag’s click is swallowed, an open row’s tap closes it, scroll stays vertical, no resting transform', () => {
  const cap = SRC.slice(SRC.indexOf('onClickCapture'));
  assert.match(cap, /if \(drag\.current\.moved\) \{[\s\S]*?e\.stopPropagation\(\)/);
  assert.match(cap, /if \(tx !== 0\) \{[\s\S]*?setTx\(0\)/);
  assert.match(SRC, /touchAction: 'pan-y'/);
  assert.match(SRC, /transform: tx === 0 && !dragging \? undefined/);
  // Closed and still, the red is not drawn at all — no hairline at a rounded row's corners.
  assert.match(SRC, /\$\{tx === 0 && !dragging \? 'invisible \[transition:visibility_0s_0\.2s\]' : ''\}/);
  // Named for whom, and reachable by keyboard on a computer.
  const row = SRC.slice(SRC.indexOf('export function SwipeToDelete'), SRC.indexOf('export function useSwipeReveal'));
  assert.equal((row.match(/aria-label=\{label\}/g) ?? []).length, 2, 'the revealed and the hover Delete are both named');
  // The rail's revealed Delete (`SwipeDeleteButton`, for a row that places itself) is named too.
  assert.match(SRC.slice(SRC.indexOf('export function SwipeDeleteButton')), /aria-label=\{label\}/, 'the rail’s Delete has no name');
  assert.match(SRC, /group-focus-within\/swipe:opacity-100/);
});

test('4a · one tap opens a row on iPhone — touch-down changes nothing visible (owner 2026-11-04 "needs a double tap?")', () => {
  // iPhone Safari drops the click of a tap whose touch-down shows/hides content (the Delete behind the row was made
  // visible by setDragging(true) in onTouchStart) — every swipe row needed a second tap. Dragging starts only once the
  // gesture is decided horizontal, inside onTouchMove.
  const start = SRC.slice(SRC.indexOf('onTouchStart'), SRC.indexOf('onTouchMove'));
  assert.doesNotMatch(start, /setDragging\(true\)/, 'touch-down must not reveal the Delete');
  assert.doesNotMatch(start, /setTx\(/, 'touch-down must not move the row');
  const move = SRC.slice(SRC.indexOf('onTouchMove'), SRC.indexOf('onTouchEnd'));
  assert.match(move, /if \(nextTx !== null\) \{\s*setDragging\(true\)/);
});

test('4b · one toast however many hosts — a row list may mount its own UndoToastHost; only the first one draws', () => {
  const host = stripComments(readFileSync(join(HERE, '../dashboard/[eventId]/guests/_components/undo-toast.tsx'), 'utf8'));
  assert.match(host, /const first = useFirstHost\(\);\s*if \(!toast \|\| !body \|\| !first\) return null;/);
  assert.match(host, /\(\) => hosts\[0\] === me/);
});

test('5 · delete with Undo: hidden now, written after the window; Undo writes nothing; a refusal comes back', async () => {
  let shown = true;
  let writes = 0;
  deleteWithUndo({ label: 'Lights deleted', hide: () => (shown = false), restore: () => (shown = true), commit: () => void writes++, windowMs: 20 });
  assert.equal(shown, false, 'not hidden at once');
  assert.equal(writes, 0, 'written before the Undo window closed');
  assert.equal(getUndoToast()?.kind, 'undo');
  await wait(320);
  assert.equal(writes, 1);
  assert.equal(shown, false);

  shown = true;
  deleteWithUndo({ label: 'Lights deleted', hide: () => (shown = false), restore: () => (shown = true), commit: () => void writes++, windowMs: 20 });
  await runUndo();
  assert.equal(shown, true, 'Undo did not bring it back');
  await wait(320);
  assert.equal(writes, 1, 'Undo still wrote the delete');

  deleteWithUndo({ label: 'x', hide: () => (shown = false), restore: () => (shown = true), commit: () => ({ ok: false, error: 'no' }), windowMs: 20 });
  await wait(320);
  assert.equal(shown, true, 'a refused delete left the row hidden');

  const { flush } = deleteWithUndo({ label: 'x', hide: () => (shown = false), restore: () => (shown = true), commit: () => void writes++, windowMs: 60_000 });
  await flush();
  assert.equal(writes, 2, 'leaving the page did not write it');
  assert.equal(pendingDeleteCount(), 0);
  dismissUndo();
});
