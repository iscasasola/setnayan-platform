/**
 * 🔁 A SWAP SAYS WHY EACH SITS THERE, AND WHAT ELSE IT MOVES (R4 slice 6a; owner 2026-10-29, Guests prototype v13
 * `assess` / `requestMove` — *"Drop a face on a taken seat → 'Swap … ?' with why each sits there and tickable side
 * effects (+1, household)"*; who placed a seat: the 2026-10-29 answer 4, lib/seat-why.ts).
 *
 * The PROPERTIES:
 *   1. A swap always asks; a move to a free seat asks only when there is something to say (`quiet`).
 *   2. Each person once, with their table and WHY (who placed it — nothing when not recorded).
 *   3. A +1 sitting with the mover comes along, ticked — into a free seat of the new table; no seat left → a warning.
 *   4. Warnings: a +1 leaving their guest · two people kept apart sharing a table · a closest-tier guest leaving their
 *      tier's table. Three lines at most, side effects first. No pronoun is guessed — names only.
 *   5. In Guests the editor asks before a swap (a face) and before a non-quiet move (a blank), applies the ticked side
 *      effects, and says it done with Undo.
 *
 * SABOTAGE (each seen RED, then restored): `quiet` true for a swap · the +1 side effect unticked by default · the cap
 * lifted · the editor's tapFace back to a bare tradeSeats.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessSeatMove, seatMoveDoneWords, type MoveGuest } from '@/lib/seat-move-assess';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-10-30T12:00:00Z');
const g = (id: string, name: string, table: string | null, over: Partial<MoveGuest> = {}): MoveGuest => ({
  guest_id: id, name, seated_table_id: table, seat_number: table ? 0 : null, tier: 4, ...over,
});
const TABLES = new Map([
  ['T2', { label: 'Table 2', freeSeats: [5, 6] }],
  ['T5', { label: 'Table 5', freeSeats: [7] }],
  ['T9', { label: 'Table 9', freeSeats: [] }],
]);
const base = { keepApart: [], tierLabel: (t: 1 | 2 | 3 | 4) => ({ 1: 'Family & principal sponsors', 2: 'Entourage', 3: 'Extended family', 4: 'Friends & others' })[t], now: NOW };

test('1 · a swap always asks; a plain move does not', () => {
  const ana = g('a', 'Ana Reyes', 'T2', { seat_placed_by: 'couple', seat_placed_at: '2026-10-29T08:00:00Z' });
  const ben = g('b', 'Ben Cruz', 'T5', { seat_placed_by: 'auto', seat_placed_at: '2026-10-30T09:00:00Z' });
  const swap = assessSeatMove({ ...base, mover: ana, other: ben, target: { tableId: 'T5', seat: 0 }, guests: [ana, ben], tables: TABLES });
  assert.equal(swap.kind, 'swap');
  assert.equal(swap.quiet, false);
  assert.equal(swap.title, 'Swap Ana (Table 2) with Ben (Table 5)?');
  assert.deepEqual(swap.rows, [
    { guestId: 'a', name: 'Ana Reyes', where: 'Table 2', why: 'You placed Ana here · yesterday' },
    { guestId: 'b', name: 'Ben Cruz', where: 'Table 5', why: 'Auto arrange placed Ben here · today' },
  ]);
  const move = assessSeatMove({ ...base, mover: g('a', 'Ana Reyes', 'T2'), other: null, target: { tableId: 'T5', seat: 7 }, guests: [g('a', 'Ana Reyes', 'T2')], tables: TABLES });
  assert.equal(move.quiet, true);
  assert.equal(move.title, 'Move Ana to Table 5 · seat 8?');
  assert.equal(move.rows[0]!.why, null, 'a seat nobody recorded says something');
});

test('2 · a +1 sitting with them comes along (ticked) — or a warning when there is no seat', () => {
  const ana = g('a', 'Ana Reyes', 'T5');
  const ben = g('p', 'Ben Cruz', 'T5', { plus_one_of: 'a' });
  const to2 = assessSeatMove({ ...base, mover: ana, other: null, target: { tableId: 'T2', seat: 5 }, guests: [ana, ben], tables: TABLES });
  assert.deepEqual(to2.sideEffects, [{ key: 'plus:p', text: 'Ana’s +1 Ben Cruz sits with Ana now — move Ben too?', on: true, guestId: 'p', tableId: 'T2', seat: 6 }]);
  assert.equal(to2.quiet, false);
  const to9 = assessSeatMove({ ...base, mover: ana, other: null, target: { tableId: 'T9', seat: null }, guests: [ana, ben], tables: TABLES });
  assert.deepEqual(to9.warnings, ['Table 9 has no seat left for Ben Cruz, Ana’s +1']);
  for (const m of [...to2.sideEffects.map((x) => x.text), ...to9.warnings]) assert.doesNotMatch(m, /\b(him|her|his|hers|he|she)\b/i, 'a pronoun was guessed');
});

test('3 · warnings: a +1 leaving their guest, kept apart, the closest tier — capped at three lines', () => {
  const host = g('h', 'Rosa Lim', 'T2');
  const plus = g('p', 'Jun Lim', 'T2', { plus_one_of: 'h' });
  const carlo = g('c', 'Carlo Diaz', 'T5');
  const vip = g('v', 'Lola Nena', 'T2', { tier: 1 });
  const vip2 = g('v2', 'Lolo Ben', 'T2', { tier: 1 });
  const a = assessSeatMove({
    ...base,
    mover: plus,
    other: null,
    target: { tableId: 'T5', seat: 7 },
    guests: [host, plus, carlo, vip, vip2],
    tables: TABLES,
    keepApart: [{ guest_a_id: 'c', guest_b_id: 'p' }],
  });
  assert.deepEqual(a.warnings, ['Jun is Rosa’s +1 — this seats Jun away from Rosa', 'Jun and Carlo are kept apart — Carlo sits at Table 5']);
  const v = assessSeatMove({ ...base, mover: vip, other: null, target: { tableId: 'T5', seat: 7 }, guests: [vip, vip2, carlo], tables: TABLES });
  assert.deepEqual(v.warnings, ['Lola sits with the family & principal sponsors — this moves Lola away from them']);
  const many = Array.from({ length: 5 }, (_, i) => g(`k${i}`, `Kid ${i}`, 'T2', { plus_one_of: 'm' }));
  const crowd = assessSeatMove({ ...base, mover: g('m', 'Mia Tan', 'T2'), other: null, target: { tableId: 'T9', seat: null }, guests: [g('m', 'Mia Tan', 'T2'), ...many], tables: TABLES });
  assert.equal(crowd.sideEffects.length + crowd.warnings.length, 3, 'more than three lines');
});

test('4 · the done words', () => {
  const ana = g('a', 'Ana Reyes', 'T2');
  const ben = g('b', 'Ben Cruz', 'T5');
  const swap = assessSeatMove({ ...base, mover: ana, other: ben, target: { tableId: 'T5', seat: 0 }, guests: [ana, ben], tables: TABLES });
  assert.equal(seatMoveDoneWords(swap, ana, ben, 'Table 5', 0, []), 'Swapped Ana and Ben');
  const move = assessSeatMove({ ...base, mover: ana, other: null, target: { tableId: 'T5', seat: 7 }, guests: [ana], tables: TABLES });
  assert.equal(seatMoveDoneWords(move, ana, null, 'Table 5', 7, ['Jun Lim']), 'Ana → Table 5 · seat 8 (was Table 2) · moved Jun too');
});

test('5 · in Guests the editor asks first, applies the ticks, and says it done with Undo', () => {
  const ed = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));
  const tap = ed.slice(ed.indexOf('const tapFace = (guestId: string) => {'), ed.indexOf('const tapBlank = '));
  assert.match(tap, /if \(g\.seated_table_id && askBefore\(pickedId, g\.seated_table_id, g\.seat_number, guestId\)\) return;\s*tradeSeats\(pickedId, guestId\);/, 'a swap no longer asks');
  const blank = ed.slice(ed.indexOf('const tapBlank = '), ed.indexOf('const tapBlank = ') + 300);
  assert.match(blank, /if \(askBefore\(pickedId, tableId, seat, null\)\) return;\s*place\(tableId, seat\);/);
  const go = ed.slice(ed.indexOf('const doAskedMove = () => {'), ed.indexOf('const askBefore = '));
  assert.match(go, /const along = ask\.a\.sideEffects\.filter\(\(x\) => ask\.on\[x\.key\]\);/);
  assert.match(go, /for \(const x of along\) seatGuestHere\(target, x\.guestId, x\.seat\);/);
  assert.match(go, /if \(other\) return tradeSeats\(mover\.guest_id, other\.guest_id\);/, 'Undo of a swap is not the swap again');
  assert.match(ed, /const seatToast = moveNote\s*\? \{ text: moveNote\.text, onUndo: moveNote\.undo,/);
  assert.match(ed, /\{faceCardSheet\}\s*\{askMoveSheet\}/);
});
