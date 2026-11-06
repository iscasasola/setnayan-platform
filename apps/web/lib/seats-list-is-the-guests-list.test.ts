/**
 * seats-list-is-the-guests-list.test.ts — 🪑 GUESTS › SEATS › LIST IS THE GUESTS LIST, GROUPED BY TABLE (Seats S1c).
 *
 * Owner, 2026-11-01 (DECISION_LOG "SEATS STAYS ITS OWN DOOR, BUT LOOKS AND WORKS LIKE THE GUESTS LIST"): *"make Seats ›
 * List the Guests list grouped by table — same rows, headers, counts ("Table 5 · 8 of 10 seats"), shared drag-and-drop,
 * pencil only on the picked table. Auto arrange stays one action on the Seats pinned row."* · "SEATS: WHAT EACH VIEW
 * DOES": List *"is where we can pick and swap people from each table. set their table type, and see how many seats are
 * still empty. add or delete seats, add delete or swap guests"* · "ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL".
 *
 *   1 · ONE ANSWER FOR A DROP (`planSeatDrop`): an empty seat seats them, someone's seat trades, "To seat" unseats, their
 *       own seat does nothing — the drag and "tap · move" share it.
 *   2 · THE GUEST LIST'S OWN ROWS AND HEADERS — its stylesheet imported (never copied) and the shared button.
 *   3 · DRAWN: "TABLE 5 · 8 of 10 seats", a row per seat (an empty seat is a row with its Add), ✎ and Type ▾ · − N +
 *       ONLY on the picked (open) table; with no Edit held, nothing on it can move anyone.
 *   4 · THE DRAG IS THE SHARED ONE (edge scroll) with "tap · move" beside it; the plan's own writes do the moving.
 *   5 · Type ▾ is the shared dropdown over the plan's own shapes; seats − N + is the plan's own Counter; Auto arrange
 *       stays in the Seats row's ⋯.
 *
 * SABOTAGE (each seen red, then restored): `planSeatDrop` trading onto the mover's own seat → 1 · `headTools(u.key)` drawn
 * on every header (the `isOpen ?` dropped) → 3 · the list's `dragEdgeStep` call removed → 4 · `onDrop={dropSeat}`
 * unwired → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { planSeatDrop, readSeatDrop, seatDropAttrs, seatTallyWords } from './seat-list-drop';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The list wears a CSS module; under node a class reads as its own name.
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));
const LIST = read('app/dashboard/[eventId]/seating/_components/seat-list.tsx');
const ED = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');

test('1 · a drop has ONE answer: empty seat → sit · someone → trade · To seat → unseat · own seat → nothing', () => {
  const seated = { id: 'ana', seated: true };
  assert.deepEqual(planSeatDrop(seated, { kind: 'seat', tableId: 't5', seat: 2, occupantId: null }), { kind: 'place', guestId: 'ana', tableId: 't5', seat: 2 });
  assert.deepEqual(planSeatDrop(seated, { kind: 'seat', tableId: 't5', seat: 3, occupantId: 'ben' }), { kind: 'trade', guestId: 'ana', otherId: 'ben', tableId: 't5', seat: 3 });
  assert.deepEqual(planSeatDrop(seated, { kind: 'seat', tableId: 't5', seat: 1, occupantId: 'ana' }), { kind: 'none' }, 'let go on their own seat and something moved');
  assert.deepEqual(planSeatDrop(seated, { kind: 'unseated' }), { kind: 'unseat', guestId: 'ana' });
  assert.deepEqual(planSeatDrop({ id: 'cy', seated: false }, { kind: 'unseated' }), { kind: 'none' }, 'an unseated guest dropped on To seat wrote something');
  assert.deepEqual(planSeatDrop(seated, null), { kind: 'none' });
  // What a row wears is what is read back — a seat, a taken seat, To seat; anything else is no drop.
  for (const t of [{ kind: 'seat', tableId: 't5', seat: 0, occupantId: null }, { kind: 'seat', tableId: 't5', seat: 7, occupantId: 'ben' }, { kind: 'unseated' }] as const) {
    const attrs = seatDropAttrs(t);
    const ds = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/^data-/, '').replace(/-(\w)/g, (_, c: string) => c.toUpperCase()), v]));
    assert.deepEqual(readSeatDrop(ds), t);
  }
  assert.equal(readSeatDrop({}), null);
  assert.equal(readSeatDrop({ seatDrop: 'seat', seatDropTable: 't5', seatDropSeat: '-1' }), null);
  assert.equal(seatTallyWords(8, 10), '8 of 10 seats');
  assert.equal(seatTallyWords(0, 1), '0 of 1 seat');
});

test('2 · the rows and headers are the Guest list’s own — its stylesheet imported, never copied, and the shared button', () => {
  assert.ok(LIST.includes("import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';"), 'Seats › List no longer reads the Guest list’s stylesheet');
  assert.ok(LIST.includes("import { ActionButton } from '@/components/action-button';"), 'the rows lost the shared button');
  for (const cls of ['gs.g', 'gs.ava', 'gs.who', 'gs.nm', 'gs.nmt', 'gs.meta', 'gs.acts', 'gs.dot']) assert.ok(LIST.includes(cls), `a seat row no longer wears the Guest row’s ${cls}`);
  for (const cls of ['gs.sec', 'gs.accSec', 'gs.open', 'gs.barWrap', 'gs.bar', 'gs.ico', 'gs.lab', 'gs.n', 'gs.chev', 'gs.fold']) assert.ok(LIST.includes(cls), `a table header no longer wears the Guest header’s ${cls}`);
  assert.match(LIST, /`\$\{gs\.barWrap\} sn-acc-head`/, 'a table header is not the house foldable header');
  // ⇔ one state for every row's buttons — the Guest list's own fit.
  assert.match(LIST, /useRowState\(listRef, /);
  // No stylesheet of its own re-draws a row (a copy is how two lists drift).
  assert.deepEqual(LIST.match(/[\w-]+\.module\.css/g), ['guests-screen.module.css'], 'Seats › List brought a stylesheet of its own');
});

test('3 · drawn: "TABLE 5 · 8 of 10 seats", a row per seat, ✎ and Type ▾ · − N + only on the picked table', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeatList } = await import('../app/dashboard/[eventId]/seating/_components/seat-list');
  const g = (id: string) => ({ id, name: `Guest ${id}`, initials: id.toUpperCase(), photo: null, side: 'bride' as const, placed: 'placed by you' });
  const seats = (key: string, n: number, filled: string[]) => Array.from({ length: n }, (_, i) => ({ tableId: key, seat: i, guest: filled[i] ? g(filled[i]!) : null }));
  const units = [
    { key: 't5', label: 'Table 5', seated: 8, capacity: 10, seats: seats('t5', 10, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) },
    { key: 't6', label: 'Table 6', seated: 1, capacity: 8, seats: seats('t6', 8, ['i']) },
  ];
  const draw = (canEdit: boolean) =>
    renderToStaticMarkup(
      React.createElement(SeatList, {
        units,
        unseated: [g('z')],
        pickedId: null,
        canEdit,
        open: new Set(['t5']),
        onToggle: () => {},
        onOpenGuest: () => {},
        onPick: () => {},
        onRemove: () => {},
        onSeatHere: () => {},
        addMenu: (t: string, s: number) => React.createElement('button', { 'data-test-add': `${t}:${s}` }, 'Add'),
        headTools: (k: string) => React.createElement('button', { 'data-test-pencil': k }, '✎'),
        renaming: () => null,
        tableTools: (k: string) => React.createElement('span', { 'data-test-tools': k }, 'Type ▾ − N +'),
        onDrop: () => {},
      }),
    );
  const html = draw(true);
  assert.match(html, />Table 5<\/span><span[^>]*data-seat-tally="">· 8 of 10 seats</, 'the header does not read "Table 5 · 8 of 10 seats"');
  assert.match(html, />Table 6<\/span><span[^>]*data-seat-tally="">· 1 of 8 seats</);
  // ✎ and the table's tools: the picked (open) table only.
  assert.deepEqual([...html.matchAll(/data-test-pencil="([^"]+)"/g)].map((m) => m[1]), ['t5'], 'a ✎ is drawn on a header that is not picked');
  assert.deepEqual([...html.matchAll(/data-test-tools="([^"]+)"/g)].map((m) => m[1]), ['t5'], 'Type ▾ / seats are drawn on a table that is not picked');
  // A row per seat on the open table: 8 guests and 2 empty seats, each empty seat with its Add.
  const t5 = html.slice(html.indexOf('data-seat-section="t5"'), html.indexOf('data-seat-section="t6"'));
  assert.equal((t5.match(/data-seat-guest="/g) ?? []).length, 8);
  assert.equal((t5.match(/data-seat-empty=""/g) ?? []).length, 2, '"8 of 10" does not draw two empty seats');
  assert.equal((t5.match(/data-test-add="/g) ?? []).length, 2, 'an empty seat has no Add');
  assert.match(t5, /data-seat-guest="a"[^>]*data-seat-drag="a"[^>]*data-seat-drop="seat" data-seat-drop-table="t5" data-seat-drop-seat="0" data-seat-drop-guest="a"/, 'a seat row is no drag source / drop seat');
  assert.match(t5, /Seat 1 · placed by you/);
  assert.match(t5, /aria-label="Swap Guest a"[\s\S]*?aria-label="Remove Guest a from the seat"/, 'a row lost Swap · Remove');
  // To seat leads, and is itself where a guest is let go to lose their seat.
  assert.ok(html.indexOf('data-seat-section="unseated"') < html.indexOf('data-seat-section="t5"'), 'To seat does not lead');
  assert.match(html, /data-seat-section="unseated"[^>]*data-seat-drop="unseated"/);
  // Without Edit held: the list reads, and nothing on it moves anyone.
  const ro = draw(false);
  assert.doesNotMatch(ro, /data-seat-drag=/, 'a guest can be dragged without Edit');
  assert.doesNotMatch(ro, /data-row-acts=""/, 'Swap / Remove / Add are offered without Edit');
});

test('4 · the drag is THE shared one (edge scroll), "tap · move" stays beside it, and the plan’s own moves do the moving', () => {
  assert.match(LIST, /import \{ dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf \} from '@\/lib\/drag-edge-scroll';/);
  assert.match(LIST, /const v = dragEdgeStep\(d\.y, dragBandOf\(d\.scroller\)\);\s*if \(v\) \{\s*dragScrollBy\(d\.scroller, v\);/, 'the list does not scroll by itself near its edge');
  assert.match(LIST, /scroller: dragScrollerOf\(p\.el\)/);
  assert.match(LIST, /box\?\.addEventListener\('touchmove', block, \{ passive: false \}\)/, 'a held guest lets the list scroll under the finger');
  assert.match(LIST, /if \(target\) onDropRef\.current\(d\.id, target\);/);
  // tap · move: Swap / Seat picks them up; an empty seat or another guest tapped is where they go.
  assert.match(LIST, /onClick=\{\(\) => onPick\(g\.id\)\}/);
  assert.match(ED, /<SeatList[\s\S]{0,900}?onOpenGuest=\{tapFace\}[\s\S]{0,400}?onRemove=\{unseat\}\s*onSeatHere=\{tapBlank\}[\s\S]{0,300}?onDrop=\{dropSeat\}/, 'the list is not wired to the plan’s own moves');
  const drop = ED.slice(ED.indexOf('const dropSeat = '), ED.indexOf('const unitOfKey = '));
  assert.match(drop, /planSeatDrop\(/);
  assert.match(drop, /return unseat\(guestId\)/);
  assert.match(drop, /askBefore\(guestId, plan\.tableId, plan\.seat, plan\.otherId\)\) return;\s*return tradeSeats\(guestId, plan\.otherId\)/, 'a trade skips "before a seat changes hands"');
  assert.match(drop, /askBefore\(guestId, plan\.tableId, plan\.seat, null\)\) return;[\s\S]*?seatGuestHere\(t, guestId, plan\.seat\)/);
});

test('5 · Type ▾ is the shared dropdown over the plan’s shapes, seats − N + the plan’s Counter; Auto arrange stays in the row’s ⋯', () => {
  const tools = ED.slice(ED.indexOf('const seatListTools = '));
  assert.match(tools, /<PickMenu\s+label="Table type"[\s\S]*?options=\{TABLE_TYPE_CATALOG\.map[\s\S]*?changeStyle\(m, k as TableType\)/);
  assert.match(tools, /\{dockSeatsStepper\(m\)\}/, 'the table lost seats − N +');
  const pen = ED.slice(ED.indexOf('const seatListPencil = '), ED.indexOf('const seatListRename = '));
  assert.match(pen, /icon=\{Pencil\}/);
  assert.match(pen, /setRenamingTable\(\(cur\) => \(cur === u\.lead\.table_id \? null : u\.lead\.table_id\)\)/);
  assert.match(ED, /label=\{isPending \? 'Arranging…' : 'Auto arrange'\}/, 'Auto arrange left the Seats row’s ⋯');
  assert.match(ED, /createPortal\(<SeatPlanToolRounds more=\{phoneMore\} trailing=\{phoneTrailing\} \/>, lens\.toolsSlot\)/);
  // The old row of faces is gone — one list, not two.
  assert.doesNotMatch(ED, /SeatFacesList|seat-faces-list/);
});
