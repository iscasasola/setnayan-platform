/**
 * the-customers-figures-are-the-pinned-row.test.ts — Customers › Dates · Money on the v13 frame (supplier dashboard v13,
 * APPROVED 2026-10-29; DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL").
 *
 * Holds what S4 built:
 *   1 · Dates' figures (booked · asking · days off) count DAYS by the month's own marks, and "days off" is "—" when the
 *       closures did not all load — never a short count.
 *   2 · Money's figures (Received · To come in · Overdue) are the ONE money picture's, and a payday read that fell short
 *       draws every one "—", never ₱0.
 *   3 · A figure renders as the shared pinned-row tile (`data-pin-door` · `data-pin-n` · `data-pin-w`), so the shared
 *       fold folds it; an unread one says so in words.
 *   4 · The page wires them: Dates hands the month its closures' completeness, Money hands the pin `picture.totals`.
 *   5 · The week strip: sticky, ‹ › a day, a flex row (no second month grid), and the day switch says "Open for bookings".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildCustomerCalendarMonth } from '@/lib/vendor-customers';
import type { SchedulePool } from '@/lib/vendor-schedule';
import { datesFiguresOf } from './dates-figures';
import { moneyFiguresOf } from './money-pin-figures';

(globalThis as unknown as { React: unknown }).React = React;

const code = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));

const POOL = { poolId: 'p1', label: 'Main', capacity: 1, categories: ['photo_video'], serviceIds: [], isHall: false } as unknown as SchedulePool;

test('1 · Dates counts days by the month’s marks; unread closures make "days off" — not 0', () => {
  const month = buildCustomerCalendarMonth(
    [POOL],
    [{ poolId: 'p1', bookedDate: '2026-10-03', eventName: 'Reyes debut' }],
    [{ poolId: null, source: 'manual', startDate: '2026-10-14', endDate: '2026-10-15' }],
    [],
    [],
    '2026-10',
    '2026-10-01',
    [{ requestedDate: '2026-10-24', count: 2 }],
  );
  const f = datesFiguresOf(month.days, true);
  assert.deepEqual(
    f.map((x) => [x.key, x.value, x.word]),
    [
      ['booked', '1', 'booked'],
      ['asking', '1', 'asking'],
      ['off', '2', 'days off'],
    ],
  );
  assert.equal(f.find((x) => x.key === 'asking')?.hot, true, 'a couple asking is not the brand colour');
  assert.equal(datesFiguresOf(month.days, false).find((x) => x.key === 'off')?.value, null, 'a short closures read was counted');
});

test('2 · Money’s figures are the money picture’s — unread is "—", never ₱0', () => {
  for (const f of moneyFiguresOf(null)) assert.equal(f.value, null, `${f.key} drew a figure from a payday read that fell short`);
  const f = moneyFiguresOf({ receivedPhp: 186000, toComePhp: 98000, bookedPhp: 284000, pct: 65, unresolved: 1, overdue: 1, bookings: 4 });
  assert.deepEqual(
    f.map((x) => [x.key, x.value, x.word]),
    [
      ['received', '₱186K', 'received'],
      ['to-come', '₱98K', 'to come in'],
      ['overdue', '1', 'overdue'],
    ],
  );
  assert.equal(f.find((x) => x.key === 'overdue')?.hot, true);
  assert.ok(f.every((x) => x.href?.startsWith('/vendor-dashboard/customers?seg=money')), 'a Money figure is a dead number');
});

test('3 · a figure is the shared pinned-row tile; an unread one says so', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersFigures } = await import('./_components/customers-figures');
  const html = renderToStaticMarkup(
    React.createElement(CustomersFigures, {
      label: 'Your money',
      figures: [
        { key: 'a', value: '3', word: 'booked', jump: 'booked' },
        { key: 'b', value: null, word: 'received', href: '/vendor-dashboard/customers?seg=money' },
      ],
    }),
  );
  assert.equal((html.match(/data-pin-door=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-pin-n=""/g) ?? []).length, 2);
  // 📌 2026-10-31 (one door, `PinDoor`): the face says "— couldn't load"; which figure it is stays in its name.
  assert.match(html, /aria-label="received · couldn’t load"/);
  assert.match(html, />couldn’t load</);
  assert.doesNotMatch(html, />0</, 'an unread figure drew 0');
});

test('4 · the page wires the figures to the pinned row', () => {
  const PAGE = code('page.tsx');
  assert.match(PAGE, /<CustomersPin\s+seg="dates"[\s\S]{0,200}figures=\{<CustomersFigures live figures=\{firstFigures\}/);
  assert.match(PAGE, /datesFiguresOf\(\s*buildCustomerCalendarMonth\(/, 'the first paint counts with a second rule');
  assert.match(PAGE, /closuresComplete=\{!blocksIncomplete\}/, 'the month is not told its closures fell short');
  const MONEY = code('_components/money-segment.tsx');
  assert.match(MONEY, /figures=\{<CustomersFigures figures=\{moneyFiguresOf\(picture\.totals\)\}/);
  const VIEW = code('_components/money-view.tsx');
  assert.doesNotMatch(VIEW, /<PesoCount\b/, 'Money draws its figures twice — on the row and again under it');
});

test('5 · the week strip pins under the row; the day switch is "Open for bookings"', () => {
  const MONTH = code('_components/customers-calendar.tsx');
  assert.match(MONTH, /data-dates-week-strip=/);
  assert.match(MONTH, /className=\{`sticky /, 'the week strip does not pin');
  assert.match(MONTH, /aria-label="A day earlier"[\s\S]{0,120}stepDay\(-1\)/);
  assert.match(MONTH, /aria-label="A day later"[\s\S]{0,120}stepDay\(1\)/);
  assert.match(MONTH, /datesFiguresOf\(data\.days, closuresComplete\)/, 'the month stopped counting its own figures');
  assert.match(MONTH, /\{after\}\s*<\/div>/, 'the Dates folds left the block the strip pins over');
  const SWITCH = code('_components/day-open-switch.tsx');
  assert.match(SWITCH, /name="Open for bookings"/);
  assert.doesNotMatch(SWITCH, /You can take bookings/);
});
