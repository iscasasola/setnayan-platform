/**
 * GUARD — CLIENTS ON A COMPUTER: THE PICKED DAY IS COLUMN 3, READ FROM NOTHING NEW (owner "Yes, all 8" item 1, 16 Nov;
 * controller's pick 17 Nov: column 3 only once a day is picked, no extra read).
 *
 *   1. The picked day's whole block (date · Open the day › · day bar · rows) is ONE element, `data-dates-picked-col`.
 *   2. From 1280, only while that block exists, the month is a grid with the block in column 2 of the month (= the
 *      screen's third, after the rail), and the client list stays shown beside it.
 *   3. Nothing below 1280 changes: every rule sits inside the 1280 media query.
 *
 *   4. A real layout, no magic rows (audit 17 Nov): the month's parts are `top` · the day · `rest`, named as grid areas
 *      "top day" / "rest day"; the two wrappers are `display: contents` everywhere else, so the phone order is unchanged.
 *
 * Sabotage: unwrap the block (1 red) · drop `grid-area: day` (2 red) · move a rule out of the media query (3 red) ·
 * put `span 40` back (4 red) · drop the wrappers' `display: contents` (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const CAL = stripComments(readFileSync(join(import.meta.dirname, '_components/customers-calendar.tsx'), 'utf8'));
const PIN = stripComments(readFileSync(join(import.meta.dirname, '_components/customers-pin.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(import.meta.dirname, '../_components/supplier-frame.css'), 'utf8'));

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
  assert.match(b, /grid-template-areas:\s*'top day' 'rest day';/);
  assert.match(b, /> \[data-dates-picked-col\]\s*\{[^}]*grid-area:\s*day;/);
  assert.match(b, /> \[data-dates-month-top\]\s*\{[^}]*grid-area:\s*top;/);
  assert.match(b, /> \[data-dates-month-rest\]\s*\{[^}]*grid-area:\s*rest;/);
  assert.match(b, /\[data-customers-whole-list\]\[hidden\],?[^{]*\{\s*display:\s*block;/, 'the client list steps aside on a computer');
});

test('3 · every Clients column rule sits inside the 1280 media query', () => {
  const at = CSS.indexOf("[data-dates-month='clients']");
  const before = CSS.slice(0, at);
  const open = before.lastIndexOf('@media (min-width: 1280px)');
  assert.ok(open > 0 && before.slice(open).split('{').length - before.slice(open).split('}').length === 1, 'a Clients column rule is outside the 1280 query');
});

test('4 · a real layout: three named parts, no magic rows, the phone order unchanged', () => {
  assert.doesNotMatch(CSS, /span\s+\d{2,}/, 'a grid spans a guessed number of rows');
  assert.match(CSS, /\[data-dates-month-top\],\s*\[data-dates-month-rest\]\s*\{\s*display:\s*contents;/, 'the wrappers draw a box of their own');
  const top = CAL.indexOf('<div data-dates-month-top="">');
  const day = CAL.indexOf('<div data-dates-picked-col="">');
  const rest = CAL.indexOf('<div data-dates-month-rest="">{after}</div>');
  assert.ok(top > 0 && day > top && rest > day, 'the parts are not top · day · rest in the page order');
  assert.ok(CAL.slice(top, day).includes('{between}'), 'the month\'s own parts left the top wrapper');
});

test('5 · the quick row (Overdue · Unread) stays under the month on a computer; the phone still hides it', () => {
  assert.doesNotMatch(PIN, /dayPicked && month \? null : quickRow/, 'the quick row is dropped while a day is picked');
  assert.match(PIN, /<div hidden=\{Boolean\(dayPicked && month\)\} data-customers-quick-wrap="">\s*\{quickRow\}/);
  assert.match(CSS, /\[data-customers-quick-wrap\]\[hidden\]\s*\{\s*display:\s*block;/, 'a computer does not show it');
});
