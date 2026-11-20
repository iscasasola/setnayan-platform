/**
 * seats-list-is-table-cards.test.ts — 🪑 GUESTS › SEATS › LIST: EVERY TABLE IS A CARD (Guests redesign § 4).
 *
 * Owner, 20 Nov 2026, on `prototypes/guests_redesign_2026-11-20` — round-one pick 5: *"Seats › List = every table as a
 * card"* (name · "7 of 10" · faces · dotted empty chairs; tap a table → it rises full screen with its people, one
 * "N empty seats · Add a guest" row, and Shape · Seats · VIP at the bottom); round-two pick 5: the "Add a guest" list
 * STAYS OPEN so names are tapped one after another; then *"Yes, build it"*.
 *
 *   1 · A TABLE IS A CARD with "N of M" — a pressable card per table, its faces and its dotted chairs, capped.
 *   2 · THE COUNTS ARE WORDS — "34 seated", "0 to seat · 9 tables · 43 empty chairs", counted from the units.
 *   3 · EMPTY SEATS ARE ONE ROW on the opened table — never a row each; "Add a guest" stays open and seats at the
 *       next free seat through the plan's own drop.
 *   4 · "THIS TABLE" (the plan's own tools, Rename, Done) lives ON THE OPENED TABLE, at its foot — nowhere else.
 *
 * Each goes red if its pick is undone: the card back to a header + rows (1), a row per empty seat (3), the tools back
 * above the rows or onto the list (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The list wears a CSS module; under node a class reads as its own name.
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const LIST = stripComments(readFileSync(join(__dirname, 'seat-list.tsx'), 'utf8'));

const g = (id: string) => ({ id, name: `Guest ${id}`, initials: id.toUpperCase(), photo: null, side: 'bride' as const });
const seats = (key: string, n: number, filled: number) => Array.from({ length: n }, (_, i) => ({ tableId: key, seat: i, guest: i < filled ? g(`${key}${i}`) : null }));
const UNITS = [
  { key: 'sw', label: 'Sweetheart Table', seated: 2, capacity: 2, seats: seats('sw', 2, 2), vip: true },
  { key: 't1', label: 'Table 1', seated: 7, capacity: 10, seats: seats('t1', 10, 7) },
  { key: 't3', label: 'Table 3', seated: 5, capacity: 14, seats: seats('t3', 14, 5) },
];

async function draw(over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeatList } = await import('./seat-list');
  return renderToStaticMarkup(
    React.createElement(SeatList, {
      units: UNITS,
      unseated: [g('z1'), g('z2')],
      pickedId: null,
      canEdit: true,
      open: new Set<string>(),
      onToggle: () => {},
      onOpenGuest: () => {},
      onPick: () => {},
      onRemove: () => {},
      onSeatHere: () => {},
      addMenu: () => null,
      headTools: (k: string) => React.createElement('button', { 'data-test-pencil': k }, '✎'),
      renaming: () => null,
      tableTools: (k: string) => React.createElement('span', { 'data-test-tools': k }, 'Shape ▾ − N + VIP ▾'),
      onDrop: () => {},
      ...over,
    } as never),
  );
}

test('1 · every table is a card: its name, "N of M", its faces and its dotted empty chairs', async () => {
  const { seatCardCircles, SEAT_CARD_CIRCLES } = await import('./seat-list');
  const html = await draw();
  assert.deepEqual([...html.matchAll(/<button[^>]*data-seat-card="([^"]+)"/g)].map((m) => m[1]), ['sw', 't1', 't3'], 'a table is not a pressable card');
  assert.match(html, />Table 1<\/span><span[^>]*data-seat-tally="">7 of 10</, 'a card does not read "7 of 10"');
  const card = (key: string) => {
    const at = html.indexOf(`data-seat-card="${key}"`);
    return html.slice(at, html.indexOf('</button>', at));
  };
  assert.equal((card('t1').match(/data-seat-guest="/g) ?? []).length, 7, 'Table 1 does not draw its seven faces');
  assert.equal((card('t1').match(/data-seat-card-chair=""/g) ?? []).length, 3, 'Table 1 does not draw its three empty chairs');
  // A full table says so with a tick; a VIP table carries the mark.
  assert.match(card('sw'), /data-seat-card-full=""/);
  assert.match(card('sw'), /data-seat-vip-mark=""/);
  assert.match(card('sw'), /<svg[\s\S]*?2 of 2/, 'a full table has no tick');
  assert.doesNotMatch(card('t1'), /data-seat-card-full/);
  // The circles are capped: 5 of 14 draws 5 faces + 4 chairs and says "+5 empty" (the drawing's Table 3).
  assert.equal(SEAT_CARD_CIRCLES, 10);
  assert.deepEqual(seatCardCircles(5, 14), { faces: 5, dots: 4, more: '+5 empty' });
  assert.deepEqual(seatCardCircles(7, 10), { faces: 7, dots: 3, more: null });
  assert.deepEqual(seatCardCircles(12, 14), { faces: 9, dots: 0, more: '+3 more · +2 empty' });
  assert.match(card('t3'), /\+5 empty/);
  // No foldable header, no row per seat on the list itself.
  assert.doesNotMatch(html, /sn-acc-head|data-section-head/, 'the foldable table headers are back');
  assert.doesNotMatch(html, /data-seat-table-open=/, 'a table is opened before it is tapped');
  assert.match(LIST, /onClick=\{tap\(\(\) => openTable\(u\.key\)\)\}/, 'a card tapped does not open its table');
});

test('2 · the counts are words — "14 seated", "2 to seat · 3 tables · 12 empty chairs" — and no count icons', async () => {
  const html = await draw();
  const sum = html.slice(html.indexOf('data-seat-summary=""'), html.indexOf('data-seat-cards=""'));
  assert.match(sum, /data-seat-summary-seated="">14<\/b>[\s\S]*?seated/);
  assert.match(sum.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /2 to seat · 3 tables · 12 empty chairs/);
  assert.doesNotMatch(LIST, /\b(Armchair|UserMinus|CircleDot|UserRound)\b[^;]*strokeWidth=\{2\.2\}/, 'the count icons are back');
  // To seat is the first block only while anyone is unseated.
  assert.ok(html.indexOf('data-seat-section="unseated"') < html.indexOf('data-seat-cards=""'), 'To seat does not lead');
  assert.doesNotMatch(await draw({ unseated: [] }), /data-seat-section="unseated"/, 'an empty "To seat" is drawn');
});

test('3 · the opened table: people first, ONE row for all its empty seats, and "Add a guest" stays open', async () => {
  const { emptySeatWords } = await import('./seat-list');
  const html = await draw({ initialOpenKey: 't1' });
  const t1 = html.slice(html.indexOf('data-seat-table-open="t1"'));
  assert.match(t1, /7 of 10 seated/);
  assert.equal((t1.match(/data-seat-row="" data-seat-guest="/g) ?? []).length, 7, 'the opened table does not list its people');
  assert.equal((t1.match(/data-seat-empty-row=""/g) ?? []).length, 1, 'the empty seats went back to one row each');
  assert.doesNotMatch(LIST, /data-seat-empty=""|const emptyRow = /, 'the row-per-empty-seat is back');
  assert.match(t1, /3 empty seats[\s\S]*?Seats 8 to 10[\s\S]*?Add a guest/);
  assert.ok(t1.indexOf('data-seat-row=""') < t1.indexOf('data-seat-empty-row=""'), 'the people are not first');
  // Move, with its word — the shipped pick-up.
  assert.match(t1, /aria-label="Move Guest t10"[^>]*>[\s\S]*?<span class="lbl">Move<\/span>/, 'Move lost its word');
  assert.equal(emptySeatWords([4, 5, 6, 7, 8, 9]), 'Seats 5 to 10');
  assert.equal(emptySeatWords([6]), 'Seat 7');
  assert.equal(emptySeatWords([1, 4, 8]), 'Seats 2, 5 and 9');
  // The list stays open: a name tapped seats them at the next free seat and nothing closes the list.
  const add = LIST.slice(LIST.indexOf('data-seat-add-list=""'), LIST.indexOf('const seatedAll'));
  assert.match(add, /onClick=\{\(\) => onDrop\(g\.id, \{ kind: 'seat', tableId: next\.tableId, seat: next\.seat, occupantId: null \}\)\}/, 'a name tapped does not take the next free seat');
  assert.doesNotMatch(add, /setAdding\(/, '"Add a guest" closes after a name (round-two pick 5: it stays open)');
  // While someone is being moved, each empty seat is its own numbered button — Move picks an exact seat.
  const moving = await draw({ initialOpenKey: 't1', pickedId: 'sw0' });
  assert.deepEqual([...moving.matchAll(/data-seat-here="(\d+)"/g)].map((m) => m[1]), ['7', '8', '9']);
  assert.match(moving, /data-seat-moving=""[\s\S]*?Guest sw0/);
});

test('4 · "This table" sits on the opened table, at its foot: the plan’s own tools, Rename and Done', async () => {
  const closed = await draw();
  assert.doesNotMatch(closed, /data-test-tools=|data-test-pencil=|data-seat-this-table=/, 'a table’s tools are on the list, outside an opened table');
  const html = await draw({ initialOpenKey: 't1' });
  const foot = html.slice(html.indexOf('data-seat-this-table="t1"'));
  assert.ok(html.indexOf('data-seat-table-open="t1"') !== -1 && html.indexOf('data-seat-this-table="t1"') !== -1, 'the opened table has no "This table"');
  assert.match(foot, /This table/);
  assert.deepEqual([...html.matchAll(/data-test-tools="([^"]+)"/g)].map((m) => m[1]), ['t1'], 'the plan’s Shape · Seats · VIP are not re-seated on the opened table');
  assert.match(foot, /data-test-tools="t1"[\s\S]*?<span class="lbl">Rename<\/span>[\s\S]*?<span class="lbl">Done<\/span>/, 'Rename · Done are not under the tools');
  // The tools are in the sheet's FOOT (the thumb zone), after the people — never above them.
  assert.match(LIST, /<Sheet\s+open\s+full\s+rise[\s\S]*?foot=\{\s*<div[^>]*data-seat-this-table=\{openUnit\.key\}/, '"This table" left the opened table’s foot');
  assert.match(LIST, /\{tableTools\(openUnit\.key\)\}/);
  assert.equal((LIST.match(/tableTools\(/g) ?? []).length, 1, 'the table tools are drawn somewhere else too');
  // Rename is the plan's own ✎, pressed by the worded button — no second rename state here.
  assert.match(LIST, /renameHolder\.current\?\.querySelector<HTMLElement>\('button'\)\?\.click\(\)/);
  assert.match(LIST, /\{renaming\(openUnit\.key\)\}/);
});
