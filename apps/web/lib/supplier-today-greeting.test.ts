/**
 * supplier-today-greeting.test.ts — 👋 THE COVER GREETS THE SHOP, BY THE MANILA CLOCK (THE ONE BUILD, A2 guard 2).
 *
 *   · the word flips at 12:00 NN and 6:00 PM Manila, and is "morning" from 12 MN (the 12 MN – 12 MN day);
 *   · the name is the shop's `business_name`, never the person's;
 *   · the cover's "N tasks today" is the length of the Needs-you list the page draws (`needsCount` in the view) —
 *     never the old "waiting on you" number, which leaves the doors and the bills out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dateChip, greetedShop, greetingFor, greetingLine, pinnedCountsLine, tasksWord } from './supplier-today-greeting';

/** An instant at HH:MM Manila time on 7 Nov 2026 (Manila is UTC+8, no daylight saving). */
const manila = (hh: number, mm: number) => Date.UTC(2026, 10, 7, hh - 8, mm);

test('the word flips at the Manila boundaries — 00:00 · 11:59 · 12:00 · 17:59 · 18:00 · 23:59', () => {
  assert.equal(greetingFor(manila(0, 0)), 'morning');
  assert.equal(greetingFor(manila(11, 59)), 'morning');
  assert.equal(greetingFor(manila(12, 0)), 'afternoon');
  assert.equal(greetingFor(manila(17, 59)), 'afternoon');
  assert.equal(greetingFor(manila(18, 0)), 'evening');
  assert.equal(greetingFor(manila(23, 59)), 'evening');
  assert.equal(greetingLine(manila(9, 0)), 'Good morning,');
});

test('UTC midnight is 8 AM in Manila — the server clock never decides the word', () => {
  assert.equal(greetingFor(Date.UTC(2026, 10, 7, 0, 0)), 'morning');
  assert.equal(greetingFor(Date.UTC(2026, 10, 7, 16, 30)), 'morning', '16:30 UTC is 00:30 the next day in Manila');
  assert.equal(greetingFor(Date.UTC(2026, 10, 7, 10, 0)), 'evening', '10:00 UTC is 6 PM in Manila');
});

test('it greets the SHOP — and a shop with no name yet, with no name at all', () => {
  assert.equal(greetedShop('SetnaProd'), 'SetnaProd');
  assert.equal(greetedShop('  '), null);
  assert.equal(greetedShop(null), null);
  const cover = readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/today-cover.tsx'), 'utf8');
  assert.match(cover, /greetedShop\(/, 'the cover names the shop through greetedShop');
  assert.doesNotMatch(cover, /full_name|display_name|first_name/, 'the cover never reads the person’s name');
});

test('the chips: "Sat 7 Nov" · "9 tasks today" · pinned "9 tasks · 7 Nov"', () => {
  assert.equal(dateChip('2026-11-07'), 'Sat 7 Nov');
  assert.equal(tasksWord(9), '9 tasks today');
  assert.equal(tasksWord(1), '1 task today');
  assert.equal(tasksWord(0), 'Nothing today');
  assert.equal(tasksWord(null), null, 'an unread list has no count — never "0 tasks"');
  assert.equal(pinnedCountsLine(9, '2026-11-07'), '9 tasks · 7 Nov');
  assert.equal(pinnedCountsLine(null, '2026-11-07'), '7 Nov');
});

test('"N tasks" is the Needs-you list length, handed in from the one view', () => {
  const view = readFileSync(join(process.cwd(), 'lib/supplier-today-view.ts'), 'utf8');
  assert.match(view, /const needsCount = input\.deskIncomplete && needs\.length === 0 \? null : needs\.length \+ allBills\.length;/);
  const page = readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-today-screen.tsx'), 'utf8');
  assert.match(page, /tasks=\{view\.needsCount\}/, 'the cover’s count is the view’s needsCount');
  assert.doesNotMatch(page, /tasks=\{view\.numbers\.waiting/, 'never the old "waiting on you" number');
});
