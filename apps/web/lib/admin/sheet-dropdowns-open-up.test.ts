/**
 * ⬆ A dropdown in a phone sheet opens UPWARD whenever it fits there (admin reorg v10, controller 17 Nov 2026).
 * The shared placement keeps its old rule for everyone who does not ask (`prefer` absent).
 * SABOTAGE (run 2026-11-16): dropping `upFirst` from the condition turns test 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePickList } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';

const phone = { width: 390, height: 844 };
const button = { top: 500, bottom: 540, left: 16, width: 200 };

test('1 · prefer above: a list that fits above opens above, even with room below', () => {
  assert.equal(placePickList({ button, listHeight: 200, viewport: phone, prefer: 'above' }).side, 'above');
});

test('2 · prefer above never forces a list off the screen — no room above, it opens below', () => {
  assert.equal(placePickList({ button: { ...button, top: 60, bottom: 100 }, listHeight: 200, viewport: phone, prefer: 'above' }).side, 'below');
});

test('3 · without prefer, the old rule is unchanged (below when it fits)', () => {
  assert.equal(placePickList({ button, listHeight: 200, viewport: phone }).side, 'below');
});
