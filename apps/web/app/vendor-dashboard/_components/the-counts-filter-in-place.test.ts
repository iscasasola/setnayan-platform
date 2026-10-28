/**
 * the-counts-filter-in-place.test.ts — 📌 TODAY'S COUNTS ARE THE PINNED ROW, AND THEY FILTER THE LIST IN PLACE.
 *
 * Owner 2026-10-28 (corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "Running
 * shop: the counts (waiting · this week · ₱ to come in) are the pinned row and FILTER the list in place"; prototype
 * `supplier_in_place_2026-10-28` `.pin` + `flt()`), on the app-wide template (2026-10-27, "THE PINNED ROW IS THE
 * APP-WIDE TEMPLATE": … counts · ⚙).
 *
 * Held as properties, on what RENDERS:
 *   1 · ONE sticky row: three count buttons that say they are pressed (exactly one, "waiting" first) and Today's ⚙ at
 *       its right end — no link in it (a filter opens nothing, the list is right under it);
 *   2 · each count has ITS list right under the row, the other two drawn but hidden (a half-typed answer survives a
 *       switch) — the week list holds exactly the bookings the "this week" number counts, the money list exactly the
 *       bookings the "to come in" total sums; each list ends with the door to the whole of it;
 *   3 · HONEST: an unread payday says "couldn't load" on the count AND in its list — never ₱0, never "Nothing to come
 *       in"; an empty week says so in words;
 *   4 · the switch is client state only — pressing a count never navigates.
 *
 * Sabotage (2026-10-28, each run and reverted): `hidden={on !== key}` → `hidden={false}` · the week rows' `d <= 6` →
 * `d <= 7` · `money === null` branch printing "Nothing to come in" · a `<Link>` put into the pinned row · the ⚙ moved
 * before the counts — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { UpcomingEventRow } from '@/lib/vendor-overview';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');
const TODAY = '2026-10-02';
const NOW = Date.parse('2026-10-02T02:00:00Z');

const up = (id: string, date: string, inDays: number): UpcomingEventRow => ({
  id: `up-${id}`,
  eventId: id,
  eventName: `Event ${id}`,
  date,
  place: 'Makati',
  category: null,
  inDays,
  href: `/vendor-dashboard/clients/${id}?tab=details`,
  threadHref: null,
  opensCard: true,
  guests: null,
  poolId: 'p1',
});

type Draw = { paydayMeasured?: boolean };
async function draw(o: Draw = {}): Promise<{ html: string; view: import('@/lib/supplier-today-view').SupplierTodayView }> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { owedBookings } = await import('@/lib/vendor-overview');
  const owed = owedBookings(
    [
      { event_vendor_id: 'ev1', event_id: 'a', event_name: 'Cruz wedding', amount_php: 42000, due_date: '2026-10-30', confirmed: false },
      { event_vendor_id: 'ev1', event_id: 'a', event_name: 'Cruz wedding', amount_php: 78000, due_date: '2026-09-01', confirmed: true },
      { event_vendor_id: 'ev2', event_id: 'b', event_name: 'Ocampo debut', amount_php: 15000, due_date: '2026-09-28', confirmed: false },
      { event_vendor_id: 'ev3', event_id: 'c', event_name: 'Lim & Tan', amount_php: null, due_date: null, confirmed: false },
    ],
    TODAY,
  );
  const view = assembleSupplierToday({
    needsAnswer: [],
    closed: [],
    deskIncomplete: false,
    // Two inside the week (day 2 and day 6), one just past it (day 7), one far.
    upcoming: [up('a', '2026-10-04', 2), up('b', '2026-10-08', 6), up('c', '2026-10-09', 7), up('d', '2026-11-20', 49)],
    schedules: { pools: [], outside: [{ blockId: 'o1', clientName: 'Reyes debut', date: '2026-10-05', poolId: 'p1' }], complete: true },
    firstSteps: null,
    verified: true,
    findable: true,
    findability: null,
    feeBills: [],
    feeEnforced: true,
    earnings: { confirmedPhp: 78000, expectedPhp: 135000, paydayMeasured: o.paydayMeasured ?? true, owed },
    credit: null,
    payoutReadiness: 'unreadable',
    payoutHref: '/vendor-dashboard/profile#pay',
    shop: { name: 'Tita Nena', categoryWord: 'Catering', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 10,
    inquiries28: 2,
    dayFacts: null,
    todayIso: TODAY,
    now: NOW,
    since: () => new Date(NOW),
  });
  const noop = async () => {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const html = renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, { view, outcome: null, feeForecasts: {}, cards: [], askStatus: '', deskIncomplete: false, actions }),
  );
  return { html, view };
}

const listOf = (html: string, key: string) => {
  const at = html.indexOf(`data-today-list="${key}"`);
  assert.ok(at > 0, `the ${key} list is not drawn`);
  const open = html.lastIndexOf('<div', at);
  const next = ['waiting', 'week', 'money'].map((k) => html.indexOf(`data-today-list="${k}"`, at + 10)).filter((i) => i > 0);
  const end = next.length ? Math.min(...next) : html.indexOf('data-today-coming-up', at);
  return html.slice(open, end);
};

test('1 · one sticky row: three pressed-or-not counts, exactly one on, and Today’s ⚙ at its right end — no link', async () => {
  const { html } = await draw();
  const at = html.indexOf('data-today-numbers');
  const row = html.slice(html.lastIndexOf('<div', at), html.indexOf('data-today-list="waiting"'));
  assert.match(row, /class="sticky top-0[^"]*"/, 'the counts row is not sticky');
  assert.match(row, /data-pinned-row=""/);
  const keys = [...row.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*data-today-number="(\w+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(keys, [['waiting', 'true'], ['week', 'false'], ['money', 'false']], 'the three counts, in order, waiting on');
  assert.match(row, /data-menu-settings="today"/, 'Today’s ⚙ is not in the pinned row');
  assert.ok(row.lastIndexOf('data-today-number=') < row.indexOf('data-menu-settings="today"'), 'the ⚙ is not at the row’s right end');
  assert.doesNotMatch(row, /<a\b/, 'a link in the pinned row — a count filters in place, it does not leave');
});

test('2 · each count shows ITS list in place — the week list is what "this week" counts, the money list what "to come in" sums', async () => {
  const { html, view } = await draw();
  // Waiting shown; the other two drawn but hidden.
  assert.doesNotMatch(listOf(html, 'waiting').slice(0, 200), /\bhidden=""/, 'the waiting list is hidden while its count is on');
  for (const k of ['week', 'money']) assert.match(listOf(html, k).slice(0, 200), /hidden=""/, `the ${k} list shows while its count is off`);

  // The week: Event a (day 2), the outside booking (day 3), Event b (day 6) — not c (day 7), not d.
  const week = listOf(html, 'week');
  const rows = [...week.matchAll(/data-today-row="(week|week-outside)"/g)].length;
  assert.equal(String(rows), view.numbers.thisWeek, `the week list holds ${rows} rows but "this week" says ${view.numbers.thisWeek}`);
  assert.equal(rows, 3);
  assert.doesNotMatch(text(week), /Event c|Event d/, 'a booking outside the seven days is in the week list');
  assert.match(week, /href="\/vendor-dashboard\/customers\?seg=dates"/, 'the week list has no door to Dates');

  // The money: the overdue one first, then the nearest due; no row for an installment with no amount.
  const money = listOf(html, 'money');
  const labels = [...money.matchAll(/data-today-row="money"[\s\S]*?home-t[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Ocampo debut', 'Cruz wedding'], 'the money list is not who owes, most urgent first');
  assert.match(text(money), /₱15,000 · overdue/);
  assert.match(text(money), /₱42,000 · due/);
  const sum = (view.money ?? []).length;
  assert.equal(sum, 2);
  assert.match(money, /data-today-list-door=""/, 'the money list has no door to Payday');
});

test('3 · honest: an unread payday says so on the count AND in its list — never ₱0, never "Nothing to come in"', async () => {
  const { html, view } = await draw({ paydayMeasured: false });
  assert.equal(view.money, null);
  const count = html.slice(html.indexOf('data-today-number="money"'));
  assert.match(text(count.slice(count.indexOf('>') + 1, count.indexOf('</button>'))), /couldn’t load/);
  const money = listOf(html, 'money');
  assert.match(text(money), /Payments couldn’t load/);
  assert.doesNotMatch(text(money), /Nothing to come in|₱\s*0\b/, 'an unread payday reads as "nothing owed"');
});

test('4 · the switch is client state — pressing a count never navigates', () => {
  const src = code('app/vendor-dashboard/_components/today-counts.tsx');
  assert.match(src, /^'use client';/);
  assert.match(src, /onClick=\{\(\) => setOn\(key\)\}/, 'a count no longer switches the list');
  assert.match(src, /hidden=\{on !== key\}/, 'the lists are not shown and hidden in place');
  assert.doesNotMatch(src, /useRouter|router\.|window\.location|<Link\b|href=/, 'a count navigates');
  // The week rows are the same seven days the number counts (`eventsThisWeek`: inDays 0–6).
  const view = code('lib/supplier-today-view.ts');
  assert.match(view, /return d !== null && d >= 0 && d <= 6;/, 'the week list counts other days than "this week"');
  assert.match(code('lib/supplier-today.ts'), /r\.inDays >= 0 && r\.inDays <= 6/);
});
