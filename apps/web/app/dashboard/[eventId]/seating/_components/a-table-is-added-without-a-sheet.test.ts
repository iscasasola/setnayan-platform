/**
 * a-table-is-added-without-a-sheet.test.ts — ADDING A TABLE (owner 2026-11-20, "Yes, your picks"; drawing § 9 frames
 * 2 · 3 and § 10; DECISION_LOG "GUESTS › SEATS, ROUND TWO").
 *
 * THE FAULTS, live at 375 on a test event (`now/14–17`): ＋ → "New table…" → a sheet → 13 shape tiles → "Add table" →
 * the sheet STAYED OPEN → and the table had landed off the row.
 *
 *   1 · NO NEW-TABLE SHEET: shape and seats are ONE row above the Add box; Round · 10 by default; the name is filled.
 *   2 · "Round ▾" lists Round 8 · 10 · 12, then "More shapes…".
 *   3 · In Guests "New table…" opens the box, never the sheet's panel.
 *   4 · THE TABLE LANDS ON THE GRID: its spot is the shared core's (`seatingJoinRow`), the row's shifted tables are
 *       written, and the floor showed that spot first (the ghost).
 *   5 · THE BOX CLOSES BY ITSELF, and one line says so with Undo ("Table 2 added beside Table 1").
 *   6 · PICK 5 — "Add a guest" on a table STAYS OPEN for name after name.
 *
 * Sabotage (each goes red): default to another shape · list all 13 at once · route Guests to `setShowAddTable` · send
 * `computeSpawnFor`'s spot first · drop `setAddingTable(false)` · drop `picked={[]}`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { TABLE_TYPE_CATALOG } from '@/lib/seating';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const noop = () => {};

test('1 · one row above the Add box: Shape ▾ · Seats − 10 +, the name already filled — no sheet, no Cancel / Add table pair', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AddTableBar, DEFAULT_TABLE_TYPE } = await import('./seat-floor-add');
  assert.equal(DEFAULT_TABLE_TYPE, 'round_10');
  const html = renderToStaticMarkup(React.createElement(AddTableBar, { defaultLabel: 'Table 3', busy: false, onDraft: noop, onAdd: noop, onCancel: noop }));
  const shape = html.indexOf('data-floor-add-shape');
  const seats = html.indexOf('data-counter="floor-add-seats"');
  const name = html.indexOf('data-floor-add-name');
  assert.ok(shape > 0 && seats > shape && name > seats, 'the row is not Shape · Seats above the box');
  assert.match(html, /value="Table 3"/);
  assert.match(html.slice(seats), />10</, 'the seats do not open on 10');
  assert.match(html.slice(shape, seats), />Round</, 'the shape does not open on Round');
  assert.match(html, /data-floor-add-go=""/);
  assert.doesNotMatch(html, />Add table<|>Cancel</, 'the sheet’s Cancel / Add table pair is back');
  assert.doesNotMatch(html, /role="dialog"|data-sheet/, 'adding a table opens a sheet');
});

test('2 · the shape menu opens on Round 8 · 10 · 12, the rest behind "More shapes…"', async () => {
  const { QUICK_TABLE_TYPES } = await import('./seat-floor-add');
  assert.deepEqual([...QUICK_TABLE_TYPES], ['round_8', 'round_10', 'round_12']);
  assert.ok(TABLE_TYPE_CATALOG.length > QUICK_TABLE_TYPES.length);
  const src = code('seat-floor-add.tsx');
  assert.match(src, /label: 'More shapes…'/);
  assert.match(src, /setCapacity\(seatsOf\(t\)\);/, 'picking a shape does not set its seats');
});

test('3 · in Guests "New table…" opens the Add box, never the sheet', () => {
  const ed = code('seating-editor.tsx');
  const add = ed.slice(ed.indexOf('const addTable = () => {'), ed.indexOf('const goToFound'));
  const guests = add.slice(add.indexOf('if (inGuests) {'), add.indexOf('return;'));
  assert.match(guests, /setAddingTable\(true\);/);
  assert.doesNotMatch(guests, /setShowAddTable|openDetailsEditor|setPeopleOpen/, 'Guests still opens the sheet');
  assert.match(ed, /if \(k === 'table'\) return addTable\(\);/, 'the thumb row’s "New table…" is not this');
});

test('4 · the table lands on the grid — the core’s row, the row’s shifted tables written, the spot shown first', () => {
  const ed = code('seating-editor.tsx');
  assert.match(ed, /const gridSlotFor = \(type: TableType, capacity: number\) =>\s*seatingJoinRow\(/, 'the spot is not the shared core’s');
  const commit = ed.slice(ed.indexOf('const commitAddTable = '), ed.indexOf('const venueShelfBase'));
  assert.match(commit, /const slot = gridSlotFor\(d\.type, d\.capacity\);\s*const at = slot \?\? computeSpawnFor\(d\.type, d\.capacity\);/, 'the grid is not asked first');
  assert.match(commit, /fd\.set\('x_pos', String\(at\.x\)\);/);
  assert.match(commit, /for \(const m of moved\) if \(\(await writeSpot\(m\.id, m\)\) === null\) return;/, 'the re-centred row is not written');
  assert.match(ed, /data-floor-add-ghost=""/, 'the floor does not show where it lands');
  assert.match(ed, /const slot = gridSlotFor\(addDraft\.type, addDraft\.capacity\);/, 'the ghost is not the same answer the add uses');
});

test('5 · the box closes by itself; one line with Undo names the table and its neighbour', () => {
  const ed = code('seating-editor.tsx');
  const commit = ed.slice(ed.indexOf('const commitAddTable = '), ed.indexOf('const venueShelfBase'));
  const made = commit.indexOf('if (!made) return;');
  const close = commit.indexOf('setAddingTable(false);');
  assert.ok(made > 0 && close > made, 'the box does not close after the table is made (or closes on a failed save)');
  assert.match(commit, /text: beside \? `\$\{d\.label\} added beside \$\{beside\}` : `\$\{d\.label\} added`,/);
  assert.match(commit, /floorWrites\?\.deleteTable \?\? deleteTable\)\(del\)/, 'Undo does not take the table back');
  assert.match(commit, /for \(const m of before\) if/, 'Undo does not put the row back');
});

test('6 · PICK 5 — "Add a guest" stays open: a tap never closes it, and each name takes the next free seat', () => {
  const ed = code('seating-editor.tsx');
  const add = ed.slice(ed.indexOf('const seatListAdd = '), ed.indexOf('const seatListPencil'));
  assert.match(add, /picked=\{\[\]\}/, 'the list closes after each name');
  assert.match(add, /occ\.findIndex\(\(g, i\) => g === null && !gone\.has\(i\)\)/, 'the second name has no seat to take');
  // the premise: the shared dropdown stays open exactly when it is a multi pick
  const menu = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'pick-menu.tsx'), 'utf8'));
  assert.match(menu, /if \(!picked\) setOpen\(false\);/, 'PickMenu’s close rule changed — re-read this test');
});
