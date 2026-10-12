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
    if (request === 'server-only' || request === 'client-only') return {};
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
  const { SupplierTodayFirstScreen } = await import('./supplier-today-first-screen');
  const { pickSupplierNext, eventsThisWeek, owedToYouPhp, nextLook, nextSecond } = await import('@/lib/supplier-today');
  const owed = owedToYouPhp(earnings);
  const next = pickSupplierNext({
    answer: null,
    answerSince: null,
    deskIncomplete: false,
    upcoming,
    setupStep: null,
    findability: null,
    fee: null,
    owedPhp: owed,
    now: Date.UTC(2026, 8, 19),
  });
  return renderToStaticMarkup(
    React.createElement(SupplierTodayFirstScreen, {
      next,
      look: nextLook(next.kind, null),
      second: nextSecond(next, null, upcoming),
      counter: null,
      meta: null,
      // The page words the number; `null` is "payday was not read".
      numbers: { waiting: '0', waitingNow: false, thisWeek: eventsThisWeek(upcoming), toComeIn: owed === null ? null : String(owed) },
      comingUp: upcoming.slice(0, 3),
      shop: { name: 'Saysay Host and Band', line: 'Host & band · Live', live: true },
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

test('"to come in" is the booked total less what is confirmed — and the Next card says payday', async () => {
  const html = await render();
  const t = text(html);
  assert.match(t, /8170 to come in/, `the money number is not ₱10,170 − ₱2,000: ${t.slice(0, 500)}`);
  assert.doesNotMatch(t, /owed to you/, 'the redesign words it "to come in"');
  assert.match(html, /data-today-next="payday"/, 'with nothing to answer and money to come in, Next is not payday');
});

/*
  🔴 THE HONEST MONEY NUMBER (redesign S-PR1). Until 2026-10-08 an unread payday
  printed "—" over the words "owed to you" — a dash a supplier could read as
  "nothing". It says so in WORDS now, in the number's own place.
  SABOTAGE: `toComeIn === null ? <Unread />` replaced by printing `₱0` → RED.
*/
test('when payday was not read the number says "couldn\'t load" — never ₱0, never a bare dash over "to come in"', async () => {
  const { owedToYouPhp } = await import('@/lib/supplier-today');
  assert.equal(owedToYouPhp({ ...EARNINGS, paydayMeasured: false }), null);
  assert.equal(owedToYouPhp(null), null);
  const html = await render([booking], { ...EARNINGS, paydayMeasured: false });
  const money = html.slice(html.indexOf('data-today-number="money"'));
  const tile = text(money.slice(0, money.indexOf('</a>')));
  assert.match(tile, /couldn(?:&rsquo;|’|&#x27;|')t load/, `the unread money number does not say so: ${tile}`);
  assert.doesNotMatch(tile, /₱\s*0|\b0\b/, `an unread payday printed a zero: ${tile}`);
  assert.doesNotMatch(tile, /to come in/, 'an unread number still wears the words of a read one');
  assert.doesNotMatch(html, /data-today-next="payday"/, 'an unread payday must not be offered as money to collect');
});

test('on an event day the one Next card is "Run the day" (owner answer 2) — and the card goes dark', async () => {
  const html = await render([{ ...booking, inDays: 0 }]);
  assert.match(html, /data-today-next="run_day"/);
  assert.match(text(html), /Run the day/);
  // 🌑 Redesign S-PR1, prototype frame 02: the event-day card is ink.
  const at = html.indexOf('data-today-next="run_day"');
  const card = html.slice(at, html.indexOf('>', at) + 1);
  assert.match(card, /data-next-day=""/, 'the event-day card is not marked as the day card');
  assert.match(card, /!bg-ink/, 'the event-day card is not dark');
  // Run the day is the forward step (brand), filled; Chat is the grey second.
  assert.match(html, /class="ab ab-brand ab-main"[^>]*>(?:(?!<\/a>).)*Run the day/s, 'Run the day is not the brand main button');
  assert.match(html, /class="ab ab-neutral home-cover-ab"[^>]*>(?:(?!<\/a>).)*Chat/s, 'the grey Chat button is missing or unreadable on the dark card');
  // …and any other day the card is not dark.
  assert.doesNotMatch(await render(), /data-next-day/);
});

// ── 🔒 THE NEXT CARD IS THE FIRST THING YOU CAN TAP ────────────────────────

test('the first link or button on the first screen is the Next card’s button', async () => {
  const html = await render();
  const next = html.indexOf('data-today-next');
  const firstTap = html.search(/<(a|button)\b/);
  assert.ok(next >= 0, 'the Next card did not render');
  assert.ok(firstTap > next, 'something you can tap comes before the Next card');
  // …and the button is INSIDE the card: the first tap target sits before the
  // card's closing </div>.
  assert.ok(firstTap < html.indexOf('</div>', next), 'the first tap target is not the Next card’s own button');
});

test('Today renders the first screen before anything tappable on the page', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8'));
  // The LAST top-level return is the page itself (the earlier ones are the
  // no-shop / team-member early exits).
  const ret = src.lastIndexOf('\n  return (');
  assert.ok(ret > 0, 'Today’s render could not be found');
  const jsx = src.slice(ret);
  const first = jsx.indexOf('<SupplierTodayFirstScreen');
  assert.ok(first > 0, 'Today no longer renders SupplierTodayFirstScreen');
  const tappable = jsx.search(/<(Link|a|button|form|details|summary)\b/);
  assert.ok(tappable === -1 || tappable > first, 'a link, button or form is back above the Next card on Today');
  // Redesign S-PR1: there is no "Everything else" under the first screen any
  // more — the queue is part of the same column. The old block must not return.
  assert.equal(jsx.indexOf('id="today-all"'), -1, '"Everything else" (#today-all) is back under the first screen');
  assert.doesNotMatch(jsx, /sn-tile|sn-card/, 'a boxed tile is back on Today — rows are hairlines, not boxes');
  // The outcome toast holds nothing to press, so it may sit above the card.
  assert.ok(jsx.indexOf('<SupplierToast') > 0 && jsx.indexOf('<SupplierToast') < first, 'the outcome toast is not rendered on Today');
});
