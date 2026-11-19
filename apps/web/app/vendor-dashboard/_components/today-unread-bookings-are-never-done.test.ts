/**
 * 🔒 AN UNREAD BOOKINGS READ IS NEVER "DONE" (Today v3 part 1, controller re-review of #8032 at df4e4a684b).
 *
 * Today's one list counts an event today (red) and tomorrow (amber) — from the page's `upcoming`, which comes from the
 * overview's booked-events read (`roomRead`). If that read comes back short, the red "event today" row is simply
 * missing, and the list would still show a count and "You’re done for today": a failure that looks like success.
 *
 *   1 · the overview read says whether the bookings read reached its end (`bookingsComplete`), and the page hands
 *       Today `eventsUnread` from it;
 *   2 · eventsUnread → no count (`needsCount` null, no "N tasks today"), never "You’re done for today", and a
 *       "couldn’t load your bookings" note row on the list. Same input, read in full → "done" (anti-vacuity).
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-20): `|| i.eventsUnread` dropped from `left` (red: 2) ·
 *   the note row removed (red: 2) · `bookingsComplete` left out of the overview's return (red: 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ');
const TODAY = '2026-10-14';
const NOW = Date.parse('2026-10-14T02:00:00Z');

test('1 · the overview read says whether the bookings read finished, and the page hands it to Today', () => {
  const overview = code('lib/vendor-overview.ts');
  assert.match(overview, /const bookingsComplete = roomRead\.complete;/);
  assert.match(overview, /return \{[^}]*\bbookingsComplete\b[^}]*\};/, 'the overview read drops whether its bookings read finished');
  assert.match(code('app/vendor-dashboard/page.tsx'), /eventsUnread: data\.bookingsComplete === false,/, 'the page never tells Today the bookings were short');
});

async function build(eventsUnread: boolean) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { buildTodayV2 } = await import('./today-v2-assemble');
  const { readTodayAside } = await import('@/lib/today-aside');
  const view = assembleSupplierToday({
    needsAnswer: [],
    closed: [],
    deskIncomplete: false,
    // The short read: the event today it would have held is not here.
    upcoming: [],
    schedules: { pools: [{ id: 'main', name: 'Main team' }], outside: [], complete: true },
    firstSteps: null,
    verified: true,
    findable: true,
    findability: null,
    feeBills: [],
    feeEnforced: true,
    earnings: { confirmedPhp: 0, expectedPhp: 0, paydayMeasured: true },
    credit: null,
    payoutReadiness: 'ready',
    payoutHref: '/vendor-dashboard/shop?open=payments#shop-folds',
    shop: { name: 'Lumina Studio', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 312,
    inquiries28: 14,
    dayFacts: null,
    todayIso: TODAY,
    now: NOW,
    since: () => new Date(NOW),
  });
  const out = buildTodayV2({
    view,
    needsAnswer: [],
    closed: [],
    deskIncomplete: false,
    reads: null,
    aside: readTodayAside(null, TODAY),
    feeForecasts: {},
    payoutReadiness: 'ready',
    setupDrawn: false,
    verified: true,
    findable: true,
    findableHref: null,
    views: 312,
    inquiries28: 14,
    bookedThisMonth: 2,
    todayIso: TODAY,
    billsUnread: false,
    now: NOW,
    events: [],
    eventsUnread,
    library: false,
  });
  return { needsCount: out.view.needsCount, html: text(renderToStaticMarkup(React.createElement(React.Fragment, null, out.v2.sub, out.v2.needsRows))) };
}

test('2 · a short bookings read: no count, never "done", and the list says it could not load', async () => {
  const { EVENTS_UNREAD_LINE } = await import('@/lib/supplier-today-v2');
  const read = await build(false);
  assert.equal(read.needsCount, 0, 'anti-vacuity: read in full, an empty list counts 0');
  assert.match(read.html, /You’re done for today/, 'anti-vacuity: read in full, an empty list is done');
  const short = await build(true);
  assert.equal(short.needsCount, null, 'a short bookings read still shows a count');
  assert.doesNotMatch(short.html, /You’re done for today/, 'a short bookings read says "done" — an event today may be missing');
  assert.doesNotMatch(short.html, /\d+ tasks? today/, 'a short bookings read still says how many tasks');
  assert.ok(short.html.includes(EVENTS_UNREAD_LINE), 'the list does not say the bookings could not be loaded');
});
