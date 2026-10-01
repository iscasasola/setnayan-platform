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

async function render(upcoming: UpcomingEventRow[] = [booking]): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayFirstScreen } = await import('./supplier-today-first-screen');
  const { pickSupplierNext, eventsThisWeek, owedToYouPhp } = await import('@/lib/supplier-today');
  const owed = owedToYouPhp(EARNINGS);
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
      cover: { eyebrow: 'Host & band · Live', name: 'Saysay Host and Band' },
      next,
      numbers: { inquiries: '0', thisWeek: eventsThisWeek(upcoming), owed: owed === null ? '—' : String(owed) },
      comingUp: upcoming.slice(0, 3),
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

test('"owed to you" is the booked total less what is confirmed — and the Next card says payday', async () => {
  const html = await render();
  const t = text(html);
  assert.match(t, /8170 owed to you/, `the owed number is not ₱10,170 − ₱2,000: ${t.slice(0, 500)}`);
  assert.match(html, /data-today-next="payday"/, 'with nothing to answer and money to come in, Next is not payday');
});

test('"owed to you" is "—" when payday was not read — never ₱0', async () => {
  const { owedToYouPhp } = await import('@/lib/supplier-today');
  assert.equal(owedToYouPhp({ ...EARNINGS, paydayMeasured: false }), null);
  assert.equal(owedToYouPhp(null), null);
});

test('on an event day the one Next card is "Run the day" (owner answer 2)', async () => {
  const html = await render([{ ...booking, inDays: 0 }]);
  assert.match(html, /data-today-next="run_day"/);
  assert.match(text(html), /Run the day/);
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
  assert.ok(first < jsx.indexOf('id="today-all"'), 'the first screen moved below "Everything else"');
});
