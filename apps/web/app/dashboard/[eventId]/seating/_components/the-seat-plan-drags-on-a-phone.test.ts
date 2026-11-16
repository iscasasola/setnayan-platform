/**
 * the-seat-plan-drags-on-a-phone.test.ts — THE SEAT PLAN IS DRAG-FIRST ON A PHONE (owner 2026-11-16, DECISION_LOG
 * "seat plan guest drag on phone"; batch 2 "what Guests opens",
 * prototypes/event_pages_guests_doors_2026-11-16/event_pages_guests_doors_2026-11-16_fable.html, "Seat plan
 * (drag-first)"). It lifts the 1 Oct "no drag on a phone" for GUESTS only — `the-seat-plan-on-the-phone.test.ts` 1
 * still holds every TABLE press behind `planPress`.
 *
 *   1 · THE CHAIR IT LANDS ON — executed: the chair under the finger (within 22 px: a 44-px target), taken or free;
 *       else the table's nearest free chair; a full table lands nowhere.
 *   2 · THE TRAY RENDERS what the drawing draws — "To seat · N", the hint, 44-px faces, "+N", the group chip — and
 *       nothing when nobody is left to seat. Without Edit it says so.
 *   3 · ONE DROP, REUSED — the tray's let-go is the editor's `dropSeat` (Seats › List's own answer, `planSeatDrop`);
 *       a group is the shipped `seatGroupMembers`. No new action, no new read.
 *   4 · EVERY GUEST DROP HAS ONE UNDO LINE — a quiet place and a trade each set `moveNote`; every Undo calls the
 *       LATEST moves (`seatOps.current`), never the move's own stale render.
 *   5 · THE GESTURE — the List's hold (`SEAT_HOLD_MS`), the house slop, and the ONE edge rule (`dragEdgeStep`) for the
 *       floor's pan; the floor, tables and chairs carry the data the tray reads.
 *   6 · REACHABLE — Guests › Seats › 2D on a phone (`roomOnly && isPhone`), over the thumb row (when no table is
 *       picked), under the drop's Undo line.
 *
 * Sabotage (each goes red): make `chairToLand` return the free chair first · drop `noteDrop` from the trade branch ·
 * call `tradeSeats(` directly inside an Undo · render the tray outside `roomOnly && isPhone`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · the chair it lands on: under the finger (44-px reach), else the nearest free; a full table, none', async () => {
  const { chairToLand, CHAIR_REACH_PX } = await import('./seat-face-tray');
  assert.equal(CHAIR_REACH_PX * 2, 44, 'the reach is not the 44-px floor');
  // On a taken chair (within reach): that chair — the two trade (asked first by the editor).
  assert.equal(chairToLand([{ dist: 60, taken: false }, { dist: 10, taken: true }]), 1);
  // Between chairs: the nearest FREE one, not the nearest one.
  assert.equal(chairToLand([{ dist: 30, taken: true }, { dist: 50, taken: false }, { dist: 80, taken: false }]), 1);
  // Two within reach: the nearer.
  assert.equal(chairToLand([{ dist: 20, taken: false }, { dist: 5, taken: false }]), 1);
  // Exactly at the reach still counts as under the finger.
  assert.equal(chairToLand([{ dist: CHAIR_REACH_PX, taken: true }, { dist: 40, taken: false }]), 0);
  // Full and nothing under the finger: nowhere (the editor says the table is full).
  assert.equal(chairToLand([{ dist: 40, taken: true }, { dist: 50, taken: true }]), -1);
  // No chairs drawn (zoomed out): the editor picks the table's first free chair.
  assert.equal(chairToLand([]), -1);
});

test('2 · the tray renders the drawing — and nothing when nobody is left to seat', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeatFaceTray } = await import('./seat-face-tray');
  const noop = () => {};
  const faces = ['Tess Lim', 'Ben Cruz', 'Jun Reyes', 'Ana Dy', 'Rico Sy', 'Lea Tan', 'Mia Go', 'Noel Uy', 'Ivy Ong'].map((name, i) => ({ id: `g${i}`, name, initials: name.split(' ').map((w) => w[0]).join(''), photo: null }));
  const html = renderToStaticMarkup(
    React.createElement(SeatFaceTray, { faces, groups: [{ id: 'grp', label: 'Lim family', count: 4 }], canEdit: true, onTapFace: noop, onMore: noop, onDrop: noop, onPan: noop }),
  );
  assert.match(html, /To seat · 9/, 'the count is not everyone still to seat');
  assert.match(html, /Press and hold a face, then drag it to a chair\. Or tap · move\./);
  // Before the row is measured (here: the server) every face is drawn; the browser then keeps what fits.
  assert.equal((html.match(/data-seat-tray-face=/g) ?? []).length, 9);
  assert.match(html, /class="[^"]*\bh-11 w-11\b/, 'a face is not 44 px');
  assert.match(html, /data-seat-tray-group="grp"[^>]*class="[^"]*min-h-11/, 'the group chip is under 44 px');
  assert.match(html, /Lim family · 4/);
  assert.match(html, /touch-none/, 'a held face would scroll the page instead of lifting');
  const locked = renderToStaticMarkup(React.createElement(SeatFaceTray, { faces, groups: [], canEdit: false, onTapFace: noop, onMore: noop, onDrop: noop, onPan: noop }));
  assert.match(locked, /Tap Edit first to seat them\./);
  const empty = renderToStaticMarkup(React.createElement(SeatFaceTray, { faces: [], groups: [], canEdit: true, onTapFace: noop, onMore: noop, onDrop: noop, onPan: noop }));
  assert.equal(empty, '', 'an empty tray still draws');
});

test('3 · one drop, reused — the tray lets go into dropSeat; a group into seatGroupMembers', () => {
  const ed = code('seating-editor.tsx');
  const floor = ed.slice(ed.indexOf('const floorDrop = '), ed.indexOf('const panPlanBy = '));
  assert.ok(floor.length > 0, 'floorDrop is gone');
  assert.match(floor, /dropSeat\(item\.id, \{ kind: 'seat', tableId: t\.table_id, seat, occupantId: occ\[seat\]\?\.guest_id \?\? null \}\)/);
  assert.match(floor, /seatGroupMembers\(item\.id, t\.table_id\)/);
  assert.doesNotMatch(floor, /assignGuest|assignGroup|unassignGuest|swapSeats/, 'the floor drop writes on its own');
  const drop = ed.slice(ed.indexOf('const dropSeat = '), ed.indexOf('const noteDrop = '));
  assert.match(drop, /planSeatDrop\(/, 'dropSeat no longer asks planSeatDrop');
  assert.match(drop, /askBefore\(guestId, plan\.tableId, plan\.seat, plan\.otherId\)/, 'a trade no longer asks first');
});

test('4 · every guest drop has ONE Undo line, and every Undo calls the latest moves', () => {
  const ed = code('seating-editor.tsx');
  const drop = ed.slice(ed.indexOf('const dropSeat = '), ed.indexOf('const noteDrop = '));
  const trade = drop.slice(drop.indexOf("plan.kind === 'trade'"), drop.indexOf("plan.kind === 'place'"));
  const place = drop.slice(drop.indexOf("plan.kind === 'place'"));
  assert.match(trade, /noteDrop\(/, 'a trade has no Undo line');
  assert.match(place, /noteDrop\(/, 'a place has no Undo line');
  const note = ed.slice(ed.indexOf('const noteDrop = '), ed.indexOf('const floorDrop = '));
  assert.match(note, /setMoveNote\(\{/);
  assert.match(note, /seatMoveDoneWords\(/, 'the drop speaks other words than the asked move');
  assert.match(ed, /seatOps\.current = \{ tradeSeats, seatGuestHere, unseat, tables \};/);
  for (const [name, from, to] of [
    ['noteDrop', 'const noteDrop = ', 'const floorDrop = '],
    ['doAskedMove', 'const doAskedMove = ', 'const askBefore = '],
    ['putBack', 'const putBack = ', 'const moveGuestOf = '],
  ] as const) {
    const body = ed.slice(ed.indexOf(from), ed.indexOf(to));
    assert.ok(body.length > 0, `${name} is gone`);
    const undo = name === 'putBack' ? body : body.slice(body.indexOf('undo'));
    assert.doesNotMatch(undo, /(?<![.\w])(tradeSeats|seatGuestHere|unseat)\(/, `${name}: an Undo calls a move of the render it was made in (stale seats)`);
  }
});

test('2b · nothing typed: the faces that fit are measured, the "+N" is the rest, and every colour is a token', () => {
  const tray = code('seat-face-tray.tsx');
  assert.match(tray, /const slots = Math\.max\(1, Math\.floor\(\(row\.clientWidth \+ gap\) \/ \(face\.offsetWidth \+ gap\)\)\);/);
  assert.match(tray, /const more = total - shown\.length;/);
  assert.match(tray, /data-seat-tray-more=""/);
  assert.doesNotMatch(tray, /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/, 'a colour outside the tokens');
  assert.doesNotMatch(code('seating-editor.tsx'), /TRAY_FACES|comingUnseated\.slice\(0,/, 'a typed face count');
});

test('4b · a failed save takes the drop’s line back — it never reads as done', () => {
  const ed = code('seating-editor.tsx');
  const gated = ed.slice(ed.indexOf('const runGated = '), ed.indexOf('const tradeSeats = '));
  assert.match(gated, /catch \(err\) \{\s*if \(!handleLockLost\(err\)\) setNotice\(failed\);\s*setMoveNote\(null\);\s*return null;/);
});

test('5 · the gesture: the List hold, the house slop, the one edge rule — and the floor carries its data', async () => {
  const tray = code('seat-face-tray.tsx');
  assert.match(tray, /import \{ SEAT_HOLD_MS \} from '@\/lib\/seat-list-drop';/);
  assert.match(tray, /setTimeout\(\(\) => lift\(e\.clientX, e\.clientY\), SEAT_HOLD_MS\)/, 'the long-press is not the List’s hold');
  assert.match(tray, /import \{ TAP_SLOP_MOUSE, TAP_SLOP_TOUCH \} from '@\/lib\/march-drag';/);
  assert.match(tray, /dragEdgeStep\(d\.x, /, 'the floor does not pan sideways near its edges');
  assert.match(tray, /dragEdgeStep\(d\.y, /, 'the floor does not pan up or down near its edges');
  const { SEAT_HOLD_MS } = await import('@/lib/seat-list-drop');
  assert.equal(Number(/const HOLD_MS = (\d+);/.exec(code('seat-list.tsx'))?.[1]), SEAT_HOLD_MS, 'the tray and Seats › List no longer agree on a hold');
  const ed = code('seating-editor.tsx');
  assert.match(ed, /data-plan-floor=""/);
  assert.match(ed, /data-plan-table=\{t\.table_id\}/);
  assert.match(ed, /data-plan-chair=\{i\}/);
  assert.match(ed, /data-plan-chair-taken=\{occupant \? '' : undefined\}/);
  assert.match(ed, /data-\[plan-drop-over\]:outline-terracotta/, 'the table it is over is not ringed');
  assert.match(ed, /data-\[plan-drop-chair\]:outline-terracotta/, 'the chair it lands on does not light up');
});

test('6 · reachable: Guests › Seats › 2D on a phone, over the thumb row, under the Undo line', () => {
  const ed = code('seating-editor.tsx');
  assert.match(ed, /const seatTray =\s*roomOnly && isPhone && comingUnseated\.length > 0 \? \(\s*<SeatFaceTray/);
  assert.match(ed, /\{seatToast \? <SeatToast toast=\{seatToast\} \/> : null\}\s*\{seatPop \?\? tableBar \?\? seatTray\}/);
  assert.match(ed, /const roomOnly = inGuests && !in3d && view === 'plan';/);
  assert.match(ed, /onTapFace=\{openMove\}/, 'a tap is no longer the shipped "Move … to…"');
});
