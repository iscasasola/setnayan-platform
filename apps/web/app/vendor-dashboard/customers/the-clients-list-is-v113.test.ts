/**
 * the-clients-list-is-v113.test.ts — 🔒 THE CLIENTS LIST, AS v113 DRAWS IT (spec §9 #7; B1 steps 1–3; owner 2026-11-08).
 *
 *   1 · a picked day can be let go: tapping it again (month or week strip) clears it, and every day still to come in
 *       the month is listed under its own STICKY heading;
 *   2 · the day bar: "Accept bookings" + "Book a client", which opens the SHIPPED Locked QR form with the day filled —
 *       never an invented sheet (§10 #34) — and is greyed on a closed day;
 *   3 · the tiles are Booked · Schedules · Asked · To collect, in that order, each a list shown in place;
 *   4 · Overdue (n) › · Unread (n) › sit under the row: hidden at a real 0, "couldn't load" when unread, and each shows
 *       its list in place with a "Viewing all … ×" head;
 *   5 · honest words: a refused count is null ("couldn't load"), a short one "N+", a short payday "—" (null), never 0/₱0.
 *
 * Sabotage log (2026-11-08, each reverted): `setPicked((was) => (was === d ? null : d))` → `setPicked(d)` → 1 red ·
 * the Book a client href → `/vendor-dashboard/customers?add=outside` → 2 red · `zero: overdue?.n === 0` → `zero: false`
 * → 5 red · `countWords` returning `formatCount(r.n)` for a failed read → 5 red · `seatChosen` ignoring `ctx.agent` → 6
 * red · the grid un-keyed (`startAt={initialMonth}`) → 1 red · Handled by without "Me" → 7 red · the Service line back to "Clients who booked it" → 7 red.
 *   6 · Show & sort narrows the WHOLE roster by Service · Status · Client · Handled by (an agent held to their own seat),
 *       then Group by / Sort order it, under sticky headings;
 *   7 · the sheet is the Guests sheet's extracted frame (Guests re-mounted on it), with the Clients rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') {
      return { useRouter: () => ({ push() {}, replace() {} }), usePathname: () => '/vendor-dashboard/customers', useSearchParams: () => new URLSearchParams() };
    }
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (...rel: string[]) => stripComments(readFileSync(join(HERE, ...rel), 'utf8'));
const PAGE = code('page.tsx');
const MONTH = code('_components', 'customers-calendar.tsx');
const BAR = code('_components', 'day-bar.tsx');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('1 · a picked day can be let go — every day still to come, each under a sticky heading', () => {
  assert.match(MONTH, /useState<CalendarDay \| null>\(initialDay\)/, 'the picked day cannot be empty');
  assert.match(MONTH, /const toggleDay = \(d: CalendarDay\) => setPicked\(\(was\) => \(was === d \? null : d\)\);/, 'tapping the picked day again does not let it go');
  assert.match(MONTH, /onPick=\{toggleDay\}/, 'the month does not let a day go');
  assert.match(MONTH, /inMonth \? toggleDay\(d\)/, 'the week strip does not let a day go');
  // Found in the 375-px walk (2026-11-08): a strip step across a month's edge moved the rows to the new month while the
  // uncontrolled grid stayed on the old one. The grid is keyed by the month on show.
  assert.match(MONTH, /<CalendarGrid\s+key=\{month\}[\s\S]{0,120}startAt=\{`\$\{month\}-01`\}/, 'the month grid can show a different month from its rows');
  assert.match(MONTH, /data-dates-all-days=/, 'no list of every day when none is picked');
  assert.match(MONTH, /\.filter\(\(d\) => d\.date >= todayIso\)/, 'the every-day list shows days already gone');
  const head = MONTH.slice(MONTH.indexOf('data-dates-day-heading'), MONTH.indexOf('data-dates-day-heading') + 10);
  assert.ok(head.length > 0, 'no day heading');
  assert.match(MONTH, /className="sticky z-\[3\][^"]*"\s+style=\{\{ top: headTop/, 'the day heading does not pin');
  assert.match(MONTH, /const headTop = pinH \+ \(folded \? 54 : 0\);/, 'the day heading does not pin under the row and the week strip');
});

test('2 · the day bar — Accept bookings + Book a client, which is the shipped Locked QR with the day filled', async () => {
  assert.match(MONTH, /<DayBar day=\{picked\}/, 'the picked day has no day bar');
  assert.match(code('_components', 'day-open-switch.tsx'), /name="Accept bookings"/);
  const { bookAClientHref } = await import('./_components/day-bar');
  assert.equal(bookAClientHref('2026-11-14'), '/vendor-dashboard/invite?mode=locked&date=2026-11-14');
  // The invite page fills the date into the shipped generator from `?date=` — the form itself is not touched.
  const INVITE = stripComments(readFileSync(join(HERE, '..', 'invite', 'page.tsx'), 'utf8'));
  assert.match(INVITE, /<LockedQrGenerator[\s\S]{0,1200}initialDate=\{\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(search\.date/, 'the Locked QR no longer takes the day');
  assert.match(BAR, /label="Book a client"[\s\S]{0,80}href=\{bookAClientHref\(day\)\}[\s\S]{0,40}disabled=\{!open\}/, 'Book a client is not greyed on a closed day');
  assert.match(BAR, /if \(day < today\) return null;/, 'a past day draws a bar');
});

test('3 · the tiles are Booked · Schedules · Asked · To collect, each a list in place', () => {
  const doors = PAGE.slice(PAGE.indexOf('const doors: CustomersDoor[] = ['), PAGE.indexOf('const overdue = overdueRead'));
  const keys = [...doors.matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['booked', 'schedules', 'asking', 'collect'], 'the tiles are not v113’s four, in order');
  assert.deepEqual([...doors.matchAll(/word: '([a-z ]+)'/g)].map((m) => m[1]), ['booked', 'schedules', 'asked', 'to collect']);
  for (const k of ['schedules', 'collect', 'overdue', 'unread']) {
    assert.match(PAGE, new RegExp(`\\n\\s+${k}: \\(?\\s*<`), `the ${k} list is not drawn`);
  }
  assert.match(PAGE, /const panels: Record<string, ReactNode> = \{ \.\.\.rosterPanels, \.\.\.tilePanels \};/);
  // Done left the row but is still a list (spec §10: "Done survives as a Show filter value").
  assert.match(PAGE, /CUSTOMERS_LISTS\.map\(\(k\) =>/, 'the roster lists (Done among them) are gone');
  // To collect and Overdue are Money's own picture — never re-added here.
  assert.match(PAGE, /const picture = moneyPicture\(paydayIncomplete \? null : paydayRows, 'all', todayIso\);/);
});

test('4 · Overdue (n) › · Unread (n) › — hidden at 0, said when unread, each shows its list in place', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersPin } = await import('./_components/customers-pin');
  const render = (quick: unknown, initial: string | null = null) =>
    renderToStaticMarkup(
      React.createElement(CustomersPin, {
        seg: 'events',
        hrefs: { events: '/x', dates: '/x?seg=dates', money: '/x?seg=money' },
        doors: [{ key: 'booked', value: '1', word: 'booked' }],
        panels: { all: 'all', booked: 'b', overdue: 'o', unread: 'u' },
        quick,
        initial,
        gear: null,
      } as never),
    );
  const both = render([
    { key: 'overdue', word: 'Overdue', value: '3', zero: false },
    { key: 'unread', word: 'Unread', value: '2', zero: false },
  ]);
  assert.equal(count(both, /data-customers-quick="/g), 2);
  assert.match(both, /aria-controls="customers-list-overdue"[^>]*>Overdue 3 ›/);
  const none = render([
    { key: 'overdue', word: 'Overdue', value: '0', zero: true },
    { key: 'unread', word: 'Unread', value: '0', zero: true },
  ]);
  assert.equal(count(none, /data-customers-quick/g), 0, 'a real 0 still draws its button');
  const unread = render([{ key: 'unread', word: 'Unread', value: null, zero: false }]);
  assert.match(unread, /disabled=""[^>]*data-customers-quick="unread"[^>]*>Unread couldn’t load/, 'an unread count is not said');
  const viewing = render([{ key: 'overdue', word: 'Overdue', value: '3', zero: false }], 'overdue');
  assert.match(viewing, /data-customers-viewing="overdue"[\s\S]*Viewing all overdue · 3/);
  assert.match(viewing, /<div id="customers-list-overdue" data-customers-list-for="overdue">/, 'the overdue list is not shown in place');
});

test('5 · honest words — a refused count is null, a short one N+, a short payday null; never 0 or ₱0', async () => {
  const t = await import('./clients-tiles');
  assert.equal(t.countWords({ n: 0, complete: false, failed: true }), null);
  assert.equal(t.countWords({ n: 4, complete: false, failed: true }), '4+');
  assert.equal(t.countWords({ n: 4, complete: false, failed: false }), '4+');
  assert.equal(t.countWords({ n: 0, complete: true, failed: false }), '0');
  assert.equal(t.toCollectWords(null), null);
  assert.equal(t.overdueRead(null), null);
  const rows = [
    { eventId: 'a', threadId: 't1' },
    { eventId: 'b', threadId: null },
    { eventId: 'c', threadId: 't3' },
  ];
  assert.deepEqual(
    t.unreadEvents(rows, new Map([['t1', 2], ['t3', 0]])).map((r) => r.eventId),
    ['a'],
  );
  // The unread button never says 0 over a refused read.
  assert.match(PAGE, /zero: !unreadFailed && unreadRows\.length === 0/);
  assert.match(PAGE, /zero: overdue\?\.n === 0/);
});

test('6 · Show & sort narrows by Service · Status · Client · Handled by — an agent sees only theirs', async () => {
  const s = await import('./clients-show-sort');
  const row = (eventId: string, lane: string, title: string, eventDate: string | null) => ({ eventId, lane, title, eventDate }) as never;
  const rows = [row('a', 'booked', 'Ana', '2026-12-01'), row('b', 'waiting', 'Ben', null), row('c', 'booked', 'Cy', '2026-11-20')];
  const ctx = {
    serviceOf: (e: string) => ({ a: 'svc1', c: 'svc2' })[e as 'a'] ?? null,
    seatsOf: (e: string) => ({ a: ['seatA'], c: ['me1'] })[e as 'a'] ?? [],
    meSeat: 'me1',
    agent: false,
    lastActivity: () => null,
  };
  const ids = (c: Partial<import('./clients-show-sort').ClientsChoice>, x = ctx) =>
    s.narrowClients(rows, { ...s.clientsChoiceOf({}), ...c }, x).map((r: { eventId: string }) => r.eventId);
  assert.deepEqual(ids({}), ['a', 'b', 'c'], 'the plain address narrows');
  assert.deepEqual(ids({ svc: 'svc1' }), ['a']);
  assert.deepEqual(ids({ st: 'waiting' }), ['b']);
  assert.deepEqual(ids({ client: 'c' }), ['c']);
  assert.deepEqual(ids({ who: 'seatA' }), ['a']);
  assert.deepEqual(ids({ who: 'me' }), ['c']);
  assert.deepEqual(ids({ who: s.NO_SEAT }), ['b'], '"Not given to a seat" is not the unassigned events');
  // An agent is held to their own seat, whatever the address says.
  assert.deepEqual(ids({ who: 'seatA' }, { ...ctx, agent: true }), ['c'], 'an agent sees another seat’s clients');
  assert.equal(s.clientsChoiceApplied(s.clientsChoiceOf({ who: 'me' }), true), 0, 'an agent’s own seat counts as a choice');
  // Group by Day: days together, in date order, no date last; Sort Name inside.
  const key = s.groupKeyOf('day', ctx, (x: string) => x)!;
  const ordered = s.orderClients(rows, { ...s.clientsChoiceOf({ group: 'day' }) }, ctx, key).map((r: { eventId: string }) => r.eventId);
  assert.deepEqual(ordered, ['c', 'a', 'b']);
  // The plain list keeps the derivation's order (waiting first) — nothing re-sorted.
  assert.deepEqual(s.orderClients(rows, s.clientsChoiceOf({}), ctx, null).map((r: { eventId: string }) => r.eventId), ['a', 'b', 'c']);
  // The page applies it before counting and paging, and draws the headings sticky.
  assert.match(PAGE, /order: \(rows\) => orderClients\(rows, choice, clientsCtx, groupKey\)/);
  const ROSTER = code('_components', 'customers-roster.tsx');
  assert.match(ROSTER, /className="sticky z-\[3\][^"]*"\s+style=\{\{ top: 'var\(--sn-pin-h\)'/, 'the group heading does not pin');
  // A refused team read narrows nobody by a guess.
  assert.match(PAGE, /agent: teamKnown && viewerIsAgent,/);
});

test('7 · the sheet is the Guests sheet’s frame, with the Clients rows — Handled by for owners, "Your clients only" for agents', () => {
  const GUESTS = stripComments(readFileSync(join(HERE, '..', '..', 'dashboard', '[eventId]', 'guests', '_components', 'guests-filter-panel.tsx'), 'utf8'));
  assert.match(GUESTS, /<ShowSortSheet\b/, 'Guests no longer draws the shared frame');
  assert.doesNotMatch(GUESTS, /<GuestPopup\b|function TopicHead/, 'Guests draws its own frame again — two sheets that can drift');
  const SHEET = code('_components', 'clients-show-sort.tsx');
  assert.match(SHEET, /<ShowSortSheet\b/, 'Clients draws its own sheet');
  for (const name of ['Show', 'Service', 'Status', 'Client', 'Handled by', 'Group by', 'Sort']) {
    assert.match(SHEET, new RegExp(`name="${name}"`), `the sheet has no ${name} row`);
  }
  assert.match(SHEET, /name="Service"\s+line="Service shows booked clients only"/, 'Service does not say it reads booked clients only (an asking event has no service yet)');
  assert.match(SHEET, /\{ key: ALL, label: 'All seats' \}, \{ key: 'me', label: 'Me' \}, \.\.\.seats/, 'Handled by is not All seats · Me · each seat');
  assert.match(SHEET, /Your clients only/, 'an agent is not told why they see only theirs');
  assert.match(SHEET, /rootClassName="fixed inset-0 z-sn-pop"/, 'the sheet does not sit on the pop-up layer token');
  // Show is in place — no navigation for it.
  assert.match(SHEET, /window\.dispatchEvent\(new CustomEvent\(CLIENTS_SHOW_EVENT/);
  assert.match(code('_components', 'customers-pin.tsx'), /window\.addEventListener\(CLIENTS_SHOW_EVENT, pick\)/, 'the row does not hear a Show pick');
});
