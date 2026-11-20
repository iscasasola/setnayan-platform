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
  // 👥 Guests redesign pick 5 (owner 20 Nov 2026): a TABLE is a card now — the shared frame (`sn-frame`), never a hand-made
  // box — and its people rise full screen on the shared full-screen part. The ROWS stay the Guest list's own.
  assert.match(LIST, /className=\{`sn-frame sn-press [^`]*`\}/, 'a table card is not the shared frame');
  assert.match(LIST, /<RiseScreen\s+kind="stack"/, 'a tapped table does not rise on the shared full screen');
  // ⇔ one state for every row's buttons — the Guest list's own fit.
  assert.match(LIST, /useRowState\(listRef, /);
  // No stylesheet of its own re-draws a row (a copy is how two lists drift).
  assert.deepEqual(LIST.match(/[\w-]+\.module\.css/g), ['guests-screen.module.css'], 'Seats › List brought a stylesheet of its own');
});

test('3 · drawn: every table a card — "Table 5 · 8 of 10", its faces, dotted empty chairs; To seat first; counts in words', async () => {
  // 👥 Guests redesign pick 5 (owner 20 Nov 2026, drawing §4): the table's tools (✎ · Type ▾ · − N +) and its rows live on
  // the table once it rises — at rest the list is cards only.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeatList } = await import('../app/dashboard/[eventId]/seating/_components/seat-list');
  const g = (id: string) => ({ id, name: `Guest ${id}`, initials: id.toUpperCase(), photo: null, side: 'bride' as const, placed: 'placed by you' });
  const seats = (key: string, n: number, filled: string[]) => Array.from({ length: n }, (_, i) => ({ tableId: key, seat: i, guest: filled[i] ? g(filled[i]!) : null }));
  const units = [
    { key: 't5', label: 'Table 5', seated: 8, capacity: 10, seats: seats('t5', 10, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) },
    { key: 't6', label: 'Table 6', seated: 1, capacity: 14, seats: seats('t6', 14, ['i']) },
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
  const cardOf = (key: string) => {
    const at = html.indexOf(`data-seat-card="${key}"`);
    assert.ok(at > -1, `no card for ${key}`);
    return html.slice(at, html.indexOf('</button>', at));
  };
  const t5 = cardOf('t5');
  assert.match(t5, />Table 5<\/span>/, 'the card does not name its table');
  assert.match(t5, /data-seat-tally=""><span>8 of 10<\/span>/, 'the card does not read "8 of 10"');
  assert.equal((t5.match(/data-seat-card-face=""/g) ?? []).length, 8, 'the card does not draw its eight faces');
  assert.equal((t5.match(/data-seat-card-empty=""/g) ?? []).length, 2, '"8 of 10" does not draw two dotted chairs');
  // More than ten chairs: ten drawn, the rest said ("+4 empty" — the drawing's Table 3).
  const t6 = cardOf('t6');
  assert.equal((t6.match(/data-seat-card-face=""|data-seat-card-empty=""/g) ?? []).length, 10, 'a big table draws more than ten chairs');
  assert.match(t6, /\+4 empty/);
  // A card is where a dragged guest lands: its next free seat.
  assert.match(t5, /data-seat-drop="seat" data-seat-drop-table="t5" data-seat-drop-seat="8"/, 'a card is no drop for its next free seat');
  // At rest: no ✎, no tools, no rows — they are on the risen table.
  assert.doesNotMatch(html, /data-test-pencil=|data-test-tools=|data-seat-guest=/, 'a table’s tools or rows are drawn on the cards');
  // To seat leads, and is itself where a guest is let go to lose their seat.
  assert.ok(html.indexOf('data-seat-card="unseated"') < html.indexOf('data-seat-card="t5"'), 'To seat does not lead');
  assert.match(html, /data-seat-card="unseated"[^>]*data-seat-drop="unseated"/);
  // The counts, in words: "9 seated · 1 to seat · 2 tables · 15 empty chairs".
  assert.match(html, /data-seat-count-words="seated">9<\/b>/);
  assert.match(html, /data-seat-count-words="unseated">1<\/b> to seat/);
  assert.match(html, /data-seat-count-words="tables">2<\/b> tables/);
  assert.match(html, /data-seat-count-words="empty">15<\/b> empty chairs/);
  // Rows on the risen table: still a drag source and drop seat, with Move and the swipe off the seat.
  assert.match(LIST, /data-seat-drag=\{canEdit \? g\.id : undefined\}/);
  assert.match(LIST, /label=\{where \? 'Move' : 'Seat'\}/, 'a row lost Move');
  assert.match(LIST, /label=\{`Remove \$\{g\.name\} from the seat`\}/, 'a row lost the swipe off its seat');
  // ➕ "Add a guest" keeps its names listed — each tap seats one at the next free chair (round two, pick 5).
  assert.match(LIST, /onDrop\(g\.id, \{ kind: 'seat', tableId: free\.tableId, seat: free\.seat, occupantId: null \}\)/, '"Add a guest" does not seat through the plan’s own drop');
  assert.doesNotMatch(LIST.slice(LIST.indexOf('data-seat-sheet-pick')), /setAdding\(false\)[\s\S]{0,40}data-seat-sheet-pick/, 'the names close after one tap');
  // Without Edit held: the list reads, and nothing on it moves anyone.
  const ro = draw(false);
  assert.doesNotMatch(ro, /data-seat-drag=/, 'a guest can be dragged without Edit');
});

test('4 · the drag is THE shared one (edge scroll), "tap · move" stays beside it, and the plan’s own moves do the moving', () => {
  assert.match(LIST, /import \{ dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf \} from '@\/lib\/drag-edge-scroll';/);
  assert.match(LIST, /const v = dragEdgeStep\(d\.y, dragBandOf\(d\.scroller\)\);\s*if \(v\) \{\s*dragScrollBy\(d\.scroller, v\);/, 'the list does not scroll by itself near its edge');
  assert.match(LIST, /scroller: dragScrollerOf\(p\.el\)/);
  assert.match(LIST, /box\?\.addEventListener\('touchmove', block, \{ passive: false \}\)/, 'a held guest lets the list scroll under the finger');
  assert.match(LIST, /if \(target\) onDropRef\.current\(d\.id, target\);/);
  // tap · move: Swap / Seat picks them up; an empty seat or another guest tapped is where they go.
  assert.match(LIST, /onPick\(g\.id\);\s*close\(\);/, 'Move does not pick them up and bring back the cards');
  assert.match(ED, /<SeatList[\s\S]{0,900}?onOpenGuest=\{tapFace\}[\s\S]{0,400}?onRemove=\{unseat\}\s*onSeatHere=\{tapBlank\}[\s\S]{0,300}?onDrop=\{dropSeat\}/, 'the list is not wired to the plan’s own moves');
  const drop = ED.slice(ED.indexOf('const dropSeat = '), ED.indexOf('const unitOfKey = '));
  assert.match(drop, /planSeatDrop\(/);
  assert.match(drop, /return unseat\(guestId\)/);
  /* ↩ 2026-11-16 (batch 2 "Seat plan (drag-first)": *"every guest drop shows one Undo line (trades have none today)"*):
     the trade, once asked, also says what it did with its Undo — the-seat-plan-drags-on-a-phone.test.ts 4. */
  assert.match(drop, /askBefore\(guestId, plan\.tableId, plan\.seat, plan\.otherId\)\) return;\s*tradeSeats\(guestId, plan\.otherId\);\s*return noteDrop\(/, 'a trade skips "before a seat changes hands"');
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

test('6 · the editor\'s open set is a doorbell: ONE key raises a table, more never do; closing lets the same table ring again', () => {
  // Ship review on #8064 (20 Nov): ⇕ "Expand all" added every key at once and raised one table; and a table already in
  // the set could never ring again, so a second Enter on the same search did nothing.
  assert.match(LIST, /const added = \[\.\.\.open\]\.filter\(\(k\) => !before\.has\(k\)\);\s*if \(added\.length === 1\) setSheet\(added\[0\]!\);/, 'more than one key added at once raises a table');
  assert.match(LIST, /const close = \(\) => \{\s*if \(sheet && seenOpen\.current\.has\(sheet\)\) onToggleRef\.current\(sheet\);/, 'closing the risen table leaves its key in the editor\'s set — it can never ring again');
  assert.match(LIST, /for \(const k of seenOpen\.current\) onToggleRef\.current\(k\);/, 'the arrival key is never let go');
  // And the ⇕ that expanded every header is gone from the Seats row — there are no headers on Seats › List.
  assert.doesNotMatch(ED, /testId: 'seats-expand'/, '⇕ Expand all is back on the Seats row');
});
