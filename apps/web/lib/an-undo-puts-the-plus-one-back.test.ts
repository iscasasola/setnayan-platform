/**
 * ↩ AN UNDO PUTS THE +1 BACK TOO (walk W4/W5 18 Nov 2026, #7906 follow-up: "in the seat plan, Undo misses the +1").
 *
 * A move can carry more than the mover — the +1 who sat beside them comes along (`assessSeatMove` side effects, ticked).
 * The plain move's Undo already put everyone back; the SWAP's Undo swapped the two back and stopped, so the +1 stayed
 * at the new table. The rule is now one pure answer (`seatMoveUndo`) and both Undo lines of the editor run it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { assessSeatMove, seatMoveUndo, type MoveGuest, type SeatBefore } from './seat-move-assess';

const g = (id: string, over: Partial<MoveGuest> = {}): MoveGuest => ({ guest_id: id, name: id, seated_table_id: null, seat_number: null, tier: 3, ...over });

// Ana sits at T1 seat 0 with her +1 Jun at seat 1. Ben sits at T2 seat 4 (two free chairs beside him).
const ana = g('ana', { name: 'Ana Cruz', seated_table_id: 't1', seat_number: 0 });
const jun = g('jun', { name: 'Jun Lim', seated_table_id: 't1', seat_number: 1, plus_one_of: 'ana' });
const ben = g('ben', { name: 'Ben Uy', seated_table_id: 't2', seat_number: 4 });
const tables = new Map([
  ['t1', { label: 'Table 1', freeSeats: [2, 3] }],
  ['t2', { label: 'Table 2', freeSeats: [5, 6] }],
]);
const before = (...gs: MoveGuest[]): SeatBefore[] => gs.map((x) => ({ id: x.guest_id, tableId: x.seated_table_id, seat: x.seat_number }));

test('the case is real: swapping Ana with Ben brings her +1 Jun along', () => {
  const a = assessSeatMove({ mover: ana, target: { tableId: 't2', seat: 4 }, other: ben, guests: [ana, jun, ben], tables, keepApart: [], tierLabel: () => 'Family' });
  assert.deepEqual(a.sideEffects.map((x) => x.guestId), ['jun'], 'the +1 no longer comes along — this test lost its case');
});

test('a swap’s Undo swaps the two back AND puts the +1 back on their own chair', () => {
  const plan = seatMoveUndo('ana', 'ben', before(ana, jun));
  assert.deepEqual(plan.trade, ['ana', 'ben']);
  assert.deepEqual(plan.putBack, [{ id: 'jun', tableId: 't1', seat: 1 }], 'the +1 who came along is not put back');
});

test('a plain move’s Undo puts the mover and the +1 back, each on their own chair', () => {
  const plan = seatMoveUndo('ana', null, before(ana, jun));
  assert.equal(plan.trade, null);
  assert.deepEqual(plan.putBack, [
    { id: 'ana', tableId: 't1', seat: 0 },
    { id: 'jun', tableId: 't1', seat: 1 },
  ]);
});

test('a swap with nobody along is just the swap again (nothing put back twice)', () => {
  const plan = seatMoveUndo('ana', 'ben', before(ana));
  assert.deepEqual(plan.trade, ['ana', 'ben']);
  assert.deepEqual(plan.putBack, []);
});

test('the editor: both Undo lines run the one plan, and the plan’s put-back is not skipped after a swap', () => {
  const ed = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));
  const undoMove = ed.slice(ed.indexOf('const undoMove = '), ed.indexOf('const moveGuestOf = '));
  assert.ok(undoMove.length > 0, 'undoMove is gone');
  assert.match(undoMove, /const plan = seatMoveUndo\(moverId, otherId, before\);/);
  assert.match(undoMove, /if \(plan\.trade\) seatOps\.current\.tradeSeats\(plan\.trade\[0\], plan\.trade\[1\]\);\s*putBack\(plan\.putBack\);/, 'a swap’s Undo returns before the +1 is put back');
  assert.doesNotMatch(undoMove, /return seatOps\.current\.tradeSeats/, 'a swap’s Undo stops at the two again');
  const asked = ed.slice(ed.indexOf('const doAskedMove = '), ed.indexOf('const askBefore = '));
  assert.match(asked, /const undo = \(\) => undoMove\(mover\.guest_id, other\?\.guest_id \?\? null, before\);/, 'the asked move’s Undo is not the one plan');
  const note = ed.slice(ed.indexOf('const noteDrop = '), ed.indexOf('const floorDrop = '));
  assert.match(note, /undo: \(\) => undoMove\(mover\.guest_id, other\?\.guest_id \?\? null, before\)/, 'the quiet drop’s Undo is not the one plan');
  // The asked move's "before" still holds everyone it moves — the mover and every ticked +1.
  assert.match(asked, /const before = \[mover, \.\.\.along\.map\(/);
});
