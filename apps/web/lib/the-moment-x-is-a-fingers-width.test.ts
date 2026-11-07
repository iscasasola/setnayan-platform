import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ST-11 · the moment row's delete is a finger's width — and since 2026-11-03 it is the row's SWIPE.
 *
 * Measured (ST-11): the row's × (`.cx`) was 28px, and 36px under `(pointer: coarse)` — under the 44px touch floor on
 * desk AND phone; it was grown to a 44px box with its 28px circle kept on a span.
 *
 * ⚖ Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"): the × left the
 * row. Its delete is the shared `SwipeToDelete` (app/_components/swipe-to-delete.tsx): on a phone the revealed Remove
 * is the row's full height × `SWIPE_REVEAL_PX`; on a computer the trash is a 44 × 44 button. This guard was RE-AIMED,
 * not deleted: the floor it held is now held on the swipe, and the halo it forbade stays forbidden on the photo `.x`.
 *
 * ⚠ TWO OBVIOUS FIXES ARE RECORDED IN THE STYLESHEET AS FAILURES, and this guard still stops either coming back:
 *   · an invisible halo — `.x`: "spread over a neighbour, it took off the wrong photo (round 3)";
 *   · the app's global 44px min-height — `.x`: "on this 26px circle that drew a tall oval that reached over the words
 *     and the neighbour".
 */

const CSS = join(process.cwd(), 'app/dashboard/[eventId]/story/_components/make-it-yours.module.css');
const TSX = join(process.cwd(), 'app/dashboard/[eventId]/story/_components/make-it-yours.tsx');
const SWIPE = join(process.cwd(), 'app/_components/swipe-to-delete.tsx');

/** The moment list's own markup — from the list to the moments box beside it. */
function momentList(tsx: string): string {
  const at = tsx.indexOf('aria-label="Moments"');
  assert.ok(at > -1, 'the moment list moved — this guard must be re-aimed, not deleted');
  return tsx.slice(at, tsx.indexOf('<div className={s.box}>', at));
}

test('the moment row draws no × of its own — its delete is the swipe, reaching the same remove', () => {
  const list = momentList(readFileSync(TSX, 'utf8'));
  assert.doesNotMatch(list, /data-cx=|className=\{s\.cx\}|aria-label=\{`Remove \$\{name\}`\}/, 'the visible × is back on the moment row');
  assert.match(list, /<SwipeToDelete\b[\s\S]{0,80}label=\{`Remove \$\{name\}`\}/, 'the row is not wrapped in the swipe, named for its moment');
  assert.match(list, /onDelete=\{\(\) => onRemoveMoment\(m\.id,/, 'the swipe does not reach the same remove (and its Undo)');
  assert.match(list, /if \(!canRemoveMoment\) return row;/, 'a moment that cannot go is offered a delete');
});

test('the grip keeps its drag — a touch on it never starts the swipe', () => {
  const list = momentList(readFileSync(TSX, 'utf8'));
  assert.match(list, /onPointerDown=\{\(e\) => onGripDown\(e, m\.id\)\}\s*onTouchStart=\{\(e\) => e\.stopPropagation\(\)\}/);
});

test('the delete TARGET still clears the 44px touch floor', () => {
  const swipe = readFileSync(SWIPE, 'utf8');
  assert.match(swipe, /style=\{\{ minHeight: 44, minWidth: 44 \}\}/, 'the computer trash fell under 44px');
  assert.match(swipe, /export const SWIPE_REVEAL_PX = (\d+);/);
  assert.ok(Number(/export const SWIPE_REVEAL_PX = (\d+);/.exec(swipe)![1]) >= 44, 'the phone Remove is narrower than a finger');
});

test('the closed row covers its red — the front wears the moments box’s own paper', () => {
  const css = readFileSync(CSS, 'utf8');
  assert.match(css, /\n\.chapGround \{\s*background: var\(--paper\);/);
  assert.match(css, /\n\.box \{[^}]*background: var\(--paper\);/, 'the moments box changed ground — the swipe front must follow it');
  assert.doesNotMatch(css, /\n\.cx \{/, 'the row’s × styles came back');
});

test('no invisible halo is reintroduced on the photo ×', () => {
  // The failure this stylesheet records by name: a pseudo-element spread past the control took off the wrong photo.
  const css = readFileSync(CSS, 'utf8');
  assert.doesNotMatch(css, /\.x::(before|after)\s*\{[^}]*inset:\s*-/, '.x grew an invisible halo again — round 3 removed exactly this');
  assert.doesNotMatch(readFileSync(TSX, 'utf8'), /moment-row/, 'the dead anchor came back');
});
