/**
 * maker-half-sheet.test.ts — THE HALF SHEET'S MOVES, every one (PR-0 of the
 * Maker rearrangement; owner 2026-10-04, "EVENT DETAILS / MAKER: FOUR FIXES
 * BEFORE BUILD" + "TAPPING THE PAGE OUTSIDE THE SELECTED ELEMENT COLLAPSES ITS
 * SHEET TO A SLIM BAR"). The reducer is `lib/maker-half-sheet.ts`; the sheet
 * that wears it is `MakerHalfSheet` (`launch/_components/maker-sheet.tsx`).
 *
 *   half → dragged up → half → slim bar → restore · a tap on nothing → slim ·
 *   tap another element → switch, same section · the same element → no change ·
 *   Peek held → hidden, let go → back · × → closed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HALF_SHEET_CLOSED,
  HALF_SHEET_DRAG_PX,
  halfSheetReducer as r,
  isCanvasTapEmpty,
  slimBarWords,
  type HalfSheetAction,
  type HalfSheetState,
} from './maker-half-sheet';

const run = (actions: HalfSheetAction[], from: HalfSheetState = HALF_SHEET_CLOSED) => actions.reduce(r, from);
const opened = run([{ type: 'open', target: 'scene:names', section: 'Motion' }]);

test('opening rises to HALF — never taller, never peeking', () => {
  assert.equal(opened.size, 'half');
  assert.equal(opened.target, 'scene:names');
  assert.equal(opened.section, 'Motion');
  assert.equal(opened.peeking, false);
});

test('the grab handle: dragged up → up; down → half; down again → the slim bar; a tap on the bar restores', () => {
  const up = r(opened, { type: 'drag', dy: -120 });
  assert.equal(up.size, 'up', 'a drag up does not give more rows');
  const back = r(up, { type: 'drag', dy: 120 });
  assert.equal(back.size, 'half', 'a drag down from up does not drop back to half');
  const slim = r(back, { type: 'drag', dy: 120 });
  assert.equal(slim.size, 'slim', 'a drag down from half does not fold to the slim bar');
  assert.equal(r(slim, { type: 'restore' }).size, 'half', 'the slim bar does not restore');
  // A drag shorter than the threshold changes nothing.
  assert.equal(r(opened, { type: 'drag', dy: HALF_SHEET_DRAG_PX - 1 }), opened);
  assert.equal(r(opened, { type: 'drag', dy: -(HALF_SHEET_DRAG_PX - 1) }), opened);
  // A tap on the handle (or a keyboard press) is half ⇄ up.
  assert.equal(r(opened, { type: 'gripTap' }).size, 'up');
  assert.equal(r(up, { type: 'gripTap' }).size, 'half');
});

test('a tap on nothing folds it to the slim bar, which restores to the size it came from', () => {
  const slim = r(opened, { type: 'tapEmpty' });
  assert.equal(slim.size, 'slim');
  assert.equal(r(slim, { type: 'restore' }).size, 'half');
  const upSlim = run([{ type: 'drag', dy: -200 }, { type: 'tapEmpty' }], opened);
  assert.equal(upSlim.size, 'slim');
  assert.equal(r(upSlim, { type: 'restore' }).size, 'up', 'a sheet dragged up comes back up');
  assert.equal(r(slim, { type: 'tapEmpty' }), slim, 'a second tap on nothing changed the slim bar');
  assert.equal(r(HALF_SHEET_CLOSED, { type: 'tapEmpty' }), HALF_SHEET_CLOSED, 'a tap on nothing opens a sheet');
});

test('tap another element → the sheet switches to it on the SAME section; the same element → no change', () => {
  const other = r(opened, { type: 'tapTarget', target: 'scene:date' });
  assert.equal(other.target, 'scene:date');
  assert.equal(other.section, 'Motion', 'the switch lost the section');
  assert.equal(other.size, 'half');
  assert.equal(r(opened, { type: 'tapTarget', target: 'scene:names' }), opened, 'the same element changed the sheet');
  // From the slim bar: another element brings the sheet back, on it.
  const slim = r(opened, { type: 'tapEmpty' });
  const fromSlim = r(slim, { type: 'tapTarget', target: 'scene:date' });
  assert.deepEqual([fromSlim.size, fromSlim.target, fromSlim.section], ['half', 'scene:date', 'Motion']);
  assert.equal(r(slim, { type: 'tapTarget', target: 'scene:names' }).size, 'half', 'the same element on a slim bar does not bring it back');
  // A navigator pick (`open`) switches the same way, keeping the size the couple chose.
  const up = r(opened, { type: 'drag', dy: -200 });
  const picked = r(up, { type: 'open', target: 'row:f:hero' });
  assert.deepEqual([picked.size, picked.target, picked.section], ['up', 'row:f:hero', 'Motion']);
  assert.equal(r(picked, { type: 'open', target: 'row:f:hero' }), picked, 're-opening the same thing changed the sheet');
});

test('Peek: held → hidden; let go → back where it was; never on a slim bar or a closed sheet', () => {
  const held = r(opened, { type: 'peekStart' });
  assert.equal(held.peeking, true);
  assert.equal(held.size, 'half', 'Peek moved the sheet’s size');
  const released = r(held, { type: 'peekEnd' });
  assert.equal(released.peeking, false);
  assert.equal(released.size, 'half');
  const upHeld = run([{ type: 'drag', dy: -200 }, { type: 'peekStart' }, { type: 'peekEnd' }], opened);
  assert.equal(upHeld.size, 'up', 'Peek on a sheet dragged up did not return it up');
  const slim = r(opened, { type: 'tapEmpty' });
  assert.equal(r(slim, { type: 'peekStart' }).peeking, false, 'Peek on a slim bar');
  assert.equal(r(HALF_SHEET_CLOSED, { type: 'peekStart' }).peeking, false);
  // A tap elsewhere or a drag while held lets go.
  assert.equal(r(held, { type: 'tapEmpty' }).peeking, false);
  assert.equal(r(held, { type: 'tapTarget', target: 'scene:date' }).peeking, false);
});

test('× / Done closes and deselects — from every size', () => {
  for (const s of [opened, r(opened, { type: 'drag', dy: -200 }), r(opened, { type: 'tapEmpty' }), r(opened, { type: 'peekStart' })]) {
    assert.deepEqual(r(s, { type: 'close' }), HALF_SHEET_CLOSED);
  }
});

test('the section follows the sheet; the slim bar says title · section', () => {
  assert.equal(r(opened, { type: 'section', section: 'Arrange' }).section, 'Arrange');
  assert.equal(r(opened, { type: 'section', section: 'Motion' }), opened);
  assert.equal(slimBarWords('Names', 'Motion'), 'Names · Motion');
  assert.equal(slimBarWords('Names', null), 'Names');
});

test('the canvas’s "tap on nothing" is recognised only as the bridge says it', () => {
  assert.equal(isCanvasTapEmpty({ source: 'setnayan-site', t: 'tapOutside' }), true);
  assert.equal(isCanvasTapEmpty({ source: 'setnayan-editor', t: 'tapOutside' }), false);
  assert.equal(isCanvasTapEmpty({ source: 'setnayan-site', t: 'edit', key: 'w:countdown' }), false);
  assert.equal(isCanvasTapEmpty(null), false);
  assert.equal(isCanvasTapEmpty('tapOutside'), false);
});
