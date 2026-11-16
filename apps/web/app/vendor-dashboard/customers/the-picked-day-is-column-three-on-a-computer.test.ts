/**
 * GUARD — CLIENTS ON A COMPUTER: THE PICKED DAY IS COLUMN 3, READ FROM NOTHING NEW (owner "Yes, all 8" item 1, 16 Nov;
 * controller's pick 17 Nov: column 3 only once a day is picked, no extra read).
 *
 *   1. The picked day's whole block (date · Open the day › · day bar · rows) is ONE element, `data-dates-picked-col`.
 *   2. From 1280, only while that block exists, the month is a grid with the block in column 2 of the month (= the
 *      screen's third, after the rail), and the client list stays shown beside it.
 *   3. Nothing below 1280 changes: every rule sits inside the 1280 media query.
 *
 * Sabotage: unwrap the block (1 red) · drop `grid-column: 2` (2 red) · move a rule out of the media query (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const CAL = stripComments(readFileSync(join(import.meta.dirname, '_components/customers-calendar.tsx'), 'utf8'));
const CSS = readFileSync(join(import.meta.dirname, '../_components/supplier-frame.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('1 · the picked day is one block: head, day bar and rows inside data-dates-picked-col', () => {
  const i = CAL.indexOf('<div data-dates-picked-col="">');
  assert.ok(i > 0, 'the picked-day block is not one element');
  const block = CAL.slice(i, CAL.indexOf(') : oneScreen ? null', i));
  for (const part of ['data-dates-picked-head', '<DayBar', 'data-dates-rows']) assert.ok(block.includes(part), `${part} is outside the block`);
});

test('2 · from 1280, with a day picked: the block takes the last column, the list stays shown', () => {
  const at = CSS.indexOf("[data-dates-month='clients']:has(> [data-dates-picked-col]) {");
  assert.ok(at > 0, 'the three-column grid is gone');
  const b = CSS.slice(at);
  assert.match(b, /> \[data-dates-picked-col\]\s*\{[^}]*grid-column:\s*2;/);
  assert.match(b, /\[data-customers-whole-list\]\[hidden\]\s*\{\s*display:\s*block;/, 'the client list steps aside on a computer');
});

test('3 · every Clients column rule sits inside the 1280 media query', () => {
  const at = CSS.indexOf("[data-dates-month='clients']");
  const before = CSS.slice(0, at);
  const open = before.lastIndexOf('@media (min-width: 1280px)');
  assert.ok(open > 0 && before.slice(open).split('{').length - before.slice(open).split('}').length === 1, 'a Clients column rule is outside the 1280 query');
});
