/**
 * 🪑 THE EVENT-DAY HOME SHOWS "Head table" ONLY WHEN THE EVENT HAS A SEAT PLAN (audit of unbuilt
 * rulings, 2026-10-23, owner "yes"). A simple event — no tables at all — used to lead its day with
 * "Head table · No head table set up yet · Open seating".
 *
 *   · rendered: no tables → nothing; a head table → its name; tables but no head table → the
 *     "No head table set up yet" door (they DO seat people, so the door is useful);
 *   · a REFUSED table read is not "no tables" (review 2026-10-23): the page reads through
 *     `measuredOr`, passes `tablesFailed`, and the card stays with "Couldn't load your tables";
 *   · wired: the day-of grid still draws the card (the hiding is the card's own), so the gate
 *     cannot be skipped by a second caller.
 *
 * SABOTAGE (2026-10-23): delete the card's `return null` → 2 red; drop `!tablesFailed &&` from the
 * gate → 2 red (the failed-read render + the wiring); restore `.catch(() => [] as EventTableRow[])` on the page → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { EventTableRow } from '@/lib/seating';
import { YourTableCard, eventHasSeatPlan } from './your-table-card';

(globalThis as unknown as { React: unknown }).React = React;

const table = (id: string, type: string, label: string): EventTableRow =>
  ({ table_id: id, table_type: type, table_label: label, capacity: 12 }) as EventTableRow;
const HEAD = table('t1', 'family_head_12', 'Family table');
const ROUND = table('t2', 'round_10', 'Table 2');

const render = (headTable: EventTableRow | null, nearbyTables: EventTableRow[], tablesFailed = false) =>
  renderToStaticMarkup(React.createElement(YourTableCard, { eventId: 'e1', headTable, nearbyTables, tablesFailed }));

test('🔴 no tables at all → no "Head table" card', () => {
  assert.equal(eventHasSeatPlan(null, []), false);
  assert.equal(render(null, []), '', 'a simple event still draws the Head table card');
});

test('a head table → the card names it', () => {
  assert.equal(eventHasSeatPlan(HEAD, []), true);
  const html = render(HEAD, [ROUND]);
  assert.match(html, /Head table/);
  assert.match(html, /Family table/);
});

test('tables but no head table → the card stays, with the door to seating', () => {
  assert.equal(eventHasSeatPlan(null, [ROUND]), true);
  const html = render(null, [ROUND]);
  assert.match(html, /No head table set up yet/);
  assert.match(html, /href="\/dashboard\/e1\/seating"/);
});

test('🔴 a refused table read → the card stays and says it could not load', () => {
  const html = render(null, [], true);
  assert.match(html, /Head table/, 'a failed read hid the card — it reads as "no seat plan"');
  assert.match(html, /Couldn’t load your tables/);
  assert.doesNotMatch(html, /No head table set up yet/, 'a failed read claimed no head table was set up');
});

test('wired: the page measures the read, and the grid passes the failure to the card', () => {
  const grid = stripComments(readFileSync(join(__dirname, 'grid.tsx'), 'utf8'));
  assert.match(
    grid,
    /<YourTableCard\s+eventId=\{eventId\}\s+headTable=\{headTable\}\s+nearbyTables=\{nearbyTables\}\s+tablesFailed=\{tablesFailed\}/,
  );
  const card = stripComments(readFileSync(join(__dirname, 'your-table-card.tsx'), 'utf8'));
  assert.match(card, /if \(!tablesFailed && !eventHasSeatPlan\(headTable, nearbyTables\)\) return null;/);
  const page = stripComments(readFileSync(join(__dirname, '../../page.tsx'), 'utf8'));
  assert.match(page, /measuredOr\(fetchTables\(supabase, eventId\)/, 'the day-of table read is not measured');
  assert.doesNotMatch(page, /fetchTables\(supabase, eventId\)\.catch\(/, 'a table read still swallows its failure');
  assert.match(page, /tablesFailed=\{dayOfTablesFailed\}/, 'the page does not pass the failure to the grid');
});
