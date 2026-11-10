/**
 * THE TODAY PAGE SPEAKS TO EVERY SUPPLIER — AREA-VENDOR, 2026-09-19.
 *
 * The owner, as the supplier Saysay (a host-and-band shop, category
 * `band_dj`), with one contracted booking on the books: the focal tile said
 * "Your next shoot is on the books." and the countdown tile was headed
 * "Next shoot". A band does not shoot. Neither does a caterer, a florist, a
 * coordinator or a venue — and every one of them opens this page.
 *
 * Asserted on REAL MARKUP: the first screen is rendered with the owner's own
 * case (one booking, no inquiries), so the words tested are the words drawn —
 * never a source grep a reword could slip past.
 *
 * 📱 2026-10-01 — the focal tile and the KPI bento became ONE Next card + three
 * numbers (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE
 * RECOMMENDED ANSWERS"; prototype `supplier_app_simple_2026-10-01_fable.html`
 * frame 1). This file now renders `SupplierTodayFirstScreen` and also holds
 * the guard that THE NEXT CARD IS THE FIRST THING YOU CAN TAP on Today.
 *
 * 🔁 RE-AIMED 2026-11-08 (THE ONE BUILD, v113): the Next card and its three numbers are retired — the first screen is
 * the cover (greeting the SHOP, its ⚙), Next events, the five stats and Needs you today. The same claims on what is
 * drawn now: every craft's words · "to come in" is the booked total less what is confirmed · an unread payday says
 * "couldn't load" · on an event day the photo card says Today · the first tap is the next event's card, and the ONE ⚙
 * rides the pinned Needs-you-today row (10 Nov — it left the cover).
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
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

/** Photographer-only vocabulary. The property is "no craft-specific verb on a
 *  page every craft reads"; these are the craft words that have actually
 *  appeared on supplier-wide surfaces. */
const CRAFT_WORDS = /\b(shoot|shoots|shooting|shot|shots)\b/i;

const booking: UpcomingEventRow = {
  id: 'up-e1-2026-10-30',
  eventId: 'e1',
  eventName: 'Rosa & Ben',
  date: '2026-10-30',
  place: 'Manila',
  category: 'band_dj',
  inDays: 41,
  // The row opens the CUSTOMER CARD, named section and all — a bare client
  // route is a chat landing (#5614), and the owner reported this row opening
  // the chat on 2026-09-20. `the-upcoming-row-opens-the-customer-card.test.ts`
  // is the guard; this fixture only has to mean what a real row means.
  href: '/vendor-dashboard/clients/e1?tab=details',
  threadHref: '/vendor-dashboard/messages/t1',
  opensCard: true,
} as UpcomingEventRow;

/** Confirmed ₱2,000 of ₱10,170 booked — the owner's Saysay case. */
const EARNINGS = { confirmedPhp: 2000, expectedPhp: 10170, paydayMeasured: true };

async function render(
  upcoming: UpcomingEventRow[] = [booking],
  earnings: typeof EARNINGS | null = EARNINGS,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { TodayNextEvents } = await import('./today-next-events');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { assembleNextEvents, nextEventDay } = await import('@/lib/supplier-today-next-events');
  const NOW = Date.UTC(2026, 8, 19);
  const TODAY = '2026-09-19';
  const view = assembleSupplierToday({
    needsAnswer: [], closed: [], deskIncomplete: false, upcoming,
    schedules: { pools: [], outside: [], complete: true }, firstSteps: null, verified: true, findable: true, findability: null,
    feeBills: [], feeEnforced: true, earnings, credit: null, payoutReadiness: 'unreadable', payoutHref: '/x',
    shop: { name: 'Saysay Host and Band', categoryWord: 'Host & band', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 12, inquiries28: 1, dayFacts: null, todayIso: TODAY, now: NOW, since: () => new Date(NOW),
  });
  const next = assembleNextEvents(nextEventDay(upcoming, TODAY), {}, TODAY);
  return renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, {
      view, outcome: null, shopName: 'Saysay Host and Band', todayIso: TODAY, now: NOW,
      nextEvents: React.createElement(TodayNextEvents, { next }),
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('a supplier with a booking is told about it — in words that fit every craft', async () => {
  const t = text(await render());
  // Floor: the first screen really rendered the booking (an empty render passes nothing).
  assert.match(t, /Rosa &amp; Ben|Rosa & Ben/, `the booking did not render: ${t.slice(0, 400)}`);
  assert.match(t, /Coming up/, 'the Coming-up list did not render');
  const hit = t.match(CRAFT_WORDS);
  assert.equal(hit, null, `photographer-only word "${hit?.[0]}" on the every-supplier Today page: …${t.slice(Math.max(0, (hit?.index ?? 0) - 60), (hit?.index ?? 0) + 60)}…`);
});

test('"to come in" is the booked total less what is confirmed — on the Money stat, which jumps to the money', async () => {
  const { owedToYouPhp } = await import('@/lib/supplier-today');
  assert.equal(owedToYouPhp(EARNINGS), 8170, 'the money number is not ₱10,170 − ₱2,000');
  const html = await render();
  const money = html.slice(html.indexOf('data-today-stat="money"'), html.indexOf('</a>', html.indexOf('data-today-stat="money"')));
  assert.match(text(money), /₱8K Money to come in/, `the money stat is not ₱10,170 − ₱2,000, worded "to come in": ${text(money)}`);
  assert.doesNotMatch(text(html), /owed to you/, 'the redesign words it "to come in"');
});

/*
  🔴 THE HONEST MONEY NUMBER (redesign S-PR1). An unread payday says so in WORDS, in the number's own place.
  SABOTAGE: the Money stat printing `₱0` for null → RED.
*/
test('when payday was not read the money says "couldn\'t load" — never ₱0, never a bare dash over "to come in"', async () => {
  const { owedToYouPhp } = await import('@/lib/supplier-today');
  assert.equal(owedToYouPhp({ ...EARNINGS, paydayMeasured: false }), null);
  assert.equal(owedToYouPhp(null), null);
  const html = await render([booking], { ...EARNINGS, paydayMeasured: false });
  const at = html.indexOf('data-today-stat="money"');
  const tile = text(html.slice(html.indexOf('>', at) + 1, html.indexOf('</a>', at)));
  assert.match(tile, /couldn(?:&rsquo;|’|&#x27;|')t load/, `the unread money number does not say so: ${tile}`);
  assert.doesNotMatch(tile, /₱\s*0|\b0\b/, `an unread payday printed a zero: ${tile}`);
  assert.doesNotMatch(tile, /to come in/, 'an unread number still wears the words of a read one');
});

test('on an event day the photo card says Today — in words that fit every craft', async () => {
  const html = await render([{ ...booking, date: '2026-09-19', inDays: 0 }]);
  const card = html.slice(html.indexOf('data-today-next-events'), html.indexOf('data-today-stats'));
  assert.match(text(card), /Next events today/, 'the eyebrow does not say the day');
  assert.match(card, /data-today-next-when=""[^>]*>Today</, 'the photo card does not say Today');
  const hit = text(card).match(CRAFT_WORDS);
  assert.equal(hit, null, `photographer-only word "${hit?.[0]}" on the event-day card`);
  assert.doesNotMatch(card, /on-the-day/, 'the card opens the live console instead of the client’s Hub page');
});

// ── 🔒 THE FIRST TAPS: THE NEXT EVENT — THE ⚙ RIDES THE PINNED "NEEDS YOU TODAY" ROW ─────
// DECISION_LOG 2026-11-10 📌: the cover scrolls away and "the ⚙ moves onto the pinned Needs you today row, at its
// right end" — so the first tap is the next event's card, and the ONE ⚙ sits in the Needs-you-today heading.

test('the first tap on Today is the next event’s card; the one ⚙ is on the pinned Needs-you-today row', async () => {
  const html = await render();
  const taps = [...html.matchAll(/<(a|button)\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(taps.length >= 3, 'anti-vacuity: nothing tappable was drawn');
  assert.match(taps[0]!, /data-today-next-event="e1"/, `the first tap is not the next event: ${taps[0]}`);
  assert.equal(taps.filter((t) => /aria-label="Today settings"/.test(t)).length, 1, 'more than one ⚙ on Today');
  const pin = html.slice(html.indexOf('data-today-needs-pin'), html.indexOf('data-today-needs-rows'));
  assert.match(pin, /aria-label="Today settings"/, 'the ⚙ is not on the pinned Needs-you-today row');
});

test('Today renders the first screen before anything tappable on the page', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8'));
  // The LAST top-level return is the page itself (the earlier ones are the
  // no-shop / team-member early exits).
  const ret = src.lastIndexOf('\n  return (');
  assert.ok(ret > 0, 'Today’s render could not be found');
  const jsx = src.slice(ret);
  // The simpler Today (2026-10-14) draws the first screen through `SupplierTodayScreen` (the one drawing the dev
  // lab shares), which renders `SupplierTodayFirstScreen` first thing.
  const first = jsx.indexOf('<SupplierTodayScreen');
  assert.ok(first > 0, 'Today no longer renders SupplierTodayScreen');
  const screen = stripComments(readFileSync(join(__dirname, 'supplier-today-screen.tsx'), 'utf8'));
  const screenRet = screen.slice(screen.lastIndexOf('\n  return ('));
  assert.ok(
    screenRet.indexOf('<SupplierTodayFirstScreen') > 0 && screenRet.search(/<(Link|a|button|form|details|summary)\b/) === -1,
    'SupplierTodayScreen draws something tappable outside the first screen',
  );
  const tappable = jsx.search(/<(Link|a|button|form|details|summary)\b/);
  assert.ok(tappable === -1 || tappable > first, 'a link, button or form is back above the first screen on Today');
  // Redesign S-PR1: there is no "Everything else" under the first screen any
  // more — the queue is part of the same column. The old block must not return.
  assert.equal(jsx.indexOf('id="today-all"'), -1, '"Everything else" (#today-all) is back under the first screen');
  assert.doesNotMatch(jsx, /sn-tile|sn-card/, 'a boxed tile is back on Today — rows are hairlines, not boxes');
  // The outcome toast holds nothing to press, so it may sit above the card.
  assert.ok(jsx.indexOf('<SupplierToast') > 0 && jsx.indexOf('<SupplierToast') < first, 'the outcome toast is not rendered on Today');
});
