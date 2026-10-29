/**
 * the-customers-counts-filter-in-place.test.ts — 🔒 CUSTOMERS' PINNED ROW: People ▾ · Asking · Talking · Booked · Done · ⚙,
 * and the counts FILTER THE LIST IN PLACE.
 *
 * Owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "Customers — People
 * · Dates · Money + ⚙ on one pinned row. People: the counts (Asking · Talking · Booked · Done) filter"; the Today
 * pattern (#7026, `today-counts.tsx`) copied; "SUPPLIER CUSTOMERS ARE LISTED BY EVENT, NOT BY PERSON".
 *
 * Held by RENDERING the shipped `CustomersPin` (react-dom/server, no session) and by reading the page source (comments
 * stripped) for what only the page decides:
 *   1 · one sticky pinned row, first row, the view ▾ is ONE PickMenu, the ⚙ is the row's LAST child;
 *   2 · each count is a BUTTON (aria-pressed) — never a link: pressing it reloads nothing;
 *   3 · all four lists are drawn, exactly one shown — the pressed door's;
 *   4 · honest: an unread count says "couldn't load", never 0; the page words a short read as "N+" or null;
 *   5 · one row per EVENT: one thread per event, every roster row keyed by its event, the chat title on the row.
 *
 * Sabotage log (2026-10-28, each reverted): a door rendered as <a href> → 2 red · `hidden={on !== key}` → `hidden={false}`
 * → 3 red · `doorValue` returning `formatCount(n)` on a short read → 4 red · `threadByEvent` keeping every thread → 5 red.
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
      return {
        useRouter: () => ({ push() {}, replace() {} }),
        usePathname: () => '/vendor-dashboard/customers',
        useSearchParams: () => new URLSearchParams(),
        redirect() {
          throw new Error('redirect');
        },
      };
    }
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (...rel: string[]) => stripComments(readFileSync(join(HERE, ...rel), 'utf8'));
const PAGE = code('page.tsx');
const PIN = code('_components', 'customers-pin.tsx');

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

async function renderPin(over: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersPin } = await import('./_components/customers-pin');
  const panel = (k: string) => React.createElement('p', { 'data-panel-body': k }, `${k} rows`);
  return renderToStaticMarkup(
    React.createElement(CustomersPin, {
      seg: 'events',
      hrefs: { events: '/x', dates: '/x?seg=dates', money: '/x?seg=money' },
      doors: [
        { key: 'asking', value: '2', word: 'asking', hot: true },
        { key: 'talking', value: '3', word: 'talking' },
        { key: 'booked', value: '4', word: 'booked' },
        { key: 'done', value: '1', word: 'done' },
      ],
      panels: { asking: panel('asking'), talking: panel('talking'), booked: panel('booked'), done: panel('done') },
      initial: 'talking',
      gear: React.createElement('span', { 'data-menu-settings': 'customers' }, React.createElement('button', { type: 'button' }, '⚙')),
      ...over,
    } as never),
  );
}

/** The element that starts at `at`, cut out by tag depth. */
function elementAround(html: string, at: number): string {
  const start = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(start))![1]!;
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error('unclosed');
}

test('1 · one sticky pinned row — the view ▾ is one dropdown, the ⚙ ends the row', async () => {
  const html = await renderPin();
  assert.equal(count(html, /data-pinned-row=""/g), 1, 'not exactly one pinned row');
  assert.equal(count(html, /data-first-row=""/g), 1, 'the pinned row is not the first row (the ⚙ spot)');
  const row = elementAround(html, html.indexOf('data-pinned-row=""'));
  assert.match(row, /class="sticky top-0/, 'the row does not pin');
  assert.match(row, /data-customers-picker/, 'the view ▾ is not in the row');
  assert.doesNotMatch(PIN, /<PillTrack\b|<PillLink\b/, 'the views are a pill row — any set of choices is one dropdown');
  // The ⚙ is the last thing on the row's line.
  const line = elementAround(row, row.indexOf('role="group"'));
  assert.ok(line.lastIndexOf('data-menu-settings="customers"') > line.lastIndexOf('data-customers-door='), 'something sits after the ⚙');
});

test('2 · each count is a press that filters in place — a button with aria-pressed, never a link', async () => {
  const html = await renderPin();
  const doors = html.match(/<(?:a|button)\b[^>]*data-customers-door="[a-z]+"[^>]*>/g) ?? [];
  assert.equal(doors.length, 4, `expected 4 doors, found ${doors.length}`);
  for (const d of doors) {
    assert.match(d, /^<button\b/, `a door navigates instead of filtering: ${d}`);
    assert.match(d, /aria-pressed="(true|false)"/, `a door does not say whether it is filtering: ${d}`);
    assert.match(d, /aria-controls="customers-list-[a-z]+"/, `a door does not name the list it shows: ${d}`);
  }
  assert.deepEqual(
    doors.map((d) => /data-customers-door="([a-z]+)"/.exec(d)![1]),
    ['asking', 'talking', 'booked', 'done'],
    'the doors are not Asking · Talking · Booked · Done, in that order',
  );
  assert.equal(count(html, /aria-pressed="true"/g), 1, 'not exactly one door is pressed');
  assert.match(html, /aria-pressed="true"[^>]*data-customers-door="talking"/, 'the opening door is not the one asked for');
});

test('3 · all four lists are drawn and exactly one shows — the pressed door’s', async () => {
  const html = await renderPin({ initial: 'booked' });
  const lists = [...html.matchAll(/<div id="customers-list-([a-z]+)" data-customers-list-for="[a-z]+"( hidden="")?>/g)];
  assert.equal(lists.length, 4, `expected 4 lists, found ${lists.length}`);
  const shown = lists.filter((m) => !m[2]).map((m) => m[1]);
  assert.deepEqual(shown, ['booked'], `the lists shown are ${shown.join(', ') || 'none'} — only the pressed door’s should be`);
  // Dates and Money draw the same row with no counts and no lists.
  const plain = await renderPin({ seg: 'money', doors: null, panels: null });
  assert.equal(count(plain, /data-customers-door=/g), 0, 'Money draws counts it never read');
  assert.equal(count(plain, /data-pinned-row=""/g), 1, 'Money lost its pinned row');
});

test('4 · honest: an unread count says "couldn’t load", never 0 — and the page never words a short read as a plain number', async () => {
  const html = await renderPin({
    doors: [
      { key: 'asking', value: null, word: 'asking' },
      { key: 'talking', value: '3+', word: 'talking' },
      { key: 'booked', value: '4', word: 'booked' },
      { key: 'done', value: '1', word: 'done' },
    ],
  });
  const asking = elementAround(html, html.indexOf('data-customers-door="asking"'));
  assert.match(asking, /couldn’t load|couldn&#x27;t load|couldn&rsquo;t load/, 'an unread count does not say so');
  assert.doesNotMatch(asking, />0</, 'an unread count shows 0');
  // The page: a short read with nobody → null ("couldn't load"); with somebody → "N+"; only a complete read is plain.
  const fn = PAGE.slice(PAGE.indexOf('const doorValue = '), PAGE.indexOf('const LANE_DOOR'));
  assert.ok(fn.length > 50, 'doorValue is gone — the scan is blind');
  assert.match(fn, /if \(!short\) return formatCount\(n\);/);
  assert.match(fn, /return n > 0 \? `\$\{formatCount\(n\)\}\+` : null;/, 'a short read is worded as a plain number');
  assert.match(fn, /const short = rosterIncomplete \|\| \(k === 'booked' && outsideIncomplete\);/, 'a short read of the roster or the outside bookings is not seen');
  assert.match(PAGE, /value: doorValue\('asking'\)/, 'the doors are not worded through doorValue');
});

test('5 · one row per EVENT — one thread per event, every row keyed by its event, the event’s chat title on it', async () => {
  // One thread per event: the newest; a second thread on the same event never becomes a second row.
  assert.match(PAGE, /for \(const t of threads\) if \(!threadByEvent\.has\(t\.event_id\)\) threadByEvent\.set\(t\.event_id, t\);/, 'an event can have two rows');
  assert.match(PAGE, /for \(const eventId of rosterEventIds\) \{/, 'the roster is not derived once per event');
  // The same couple with two events = two rows, each with its own chat title.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersRoster } = await import('./_components/customers-roster');
  const NOW = Date.UTC(2026, 9, 2, 2);
  const base = {
    lane: 'booked' as const, waitingKind: null, waitingSince: null, expiresAt: null, quietDays: null,
    title: 'Indalecio Casasola', identityRevealed: true, place: 'Makati', eventVendorId: 'ev', note: null, quoted: false, returning: false,
  };
  const rows = [
    { ...base, eventId: 'e1', threadId: 't1', eventDate: '2026-12-18', kind: 'Wedding' },
    { ...base, eventId: 'e2', threadId: 't2', eventDate: '2027-12-18', kind: 'Anniversary' },
  ];
  const html = renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows, paged: { items: rows, page: 1, pageCount: 1, total: 2, start: 1, end: 2 }, query: '', incomplete: false,
      pagerKeepParams: '', counts: { waiting: 0, holding: 0, talking: 0, booked: 2, finished: 0 }, nowMs: NOW,
      holdingPerDate: new Map(), anchor: null,
    } as never),
  );
  const links = html.match(/<div [^>]*data-customer-row="booked"[^>]*>/g) ?? [];
  assert.equal(links.length, 2, 'one couple with two events is not two rows');
  assert.match(html, /href="\/vendor-dashboard\/messages\/t1"/);
  assert.match(html, /href="\/vendor-dashboard\/messages\/t2"/, 'each event row does not open its own chat');
  // 2026-10-30: the row wears the EVENT's title — its whole name · kind · day (`eventRowTitle`, owner 2026-10-29 "Customers
  // are events, not people"); the chat it opens keeps its own words.
  assert.match(html, /Indalecio Casasola · Wedding · Dec 18/, 'the row does not wear the event’s title');
  assert.match(html, /Indalecio Casasola · Anniversary · Dec 18, 2027/);
  // Drawn once per door: no duplicate `#customers` id, one chat-origin mark around all four.
  assert.doesNotMatch(html, /id="customers"/, 'a door’s list carries the page’s one #customers id');
  assert.equal(count(PAGE, /<ChatOriginMark \/>/g), 1, 'Events does not mark the chat origin exactly once');
});
