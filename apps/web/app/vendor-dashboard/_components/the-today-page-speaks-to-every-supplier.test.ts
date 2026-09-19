/**
 * THE TODAY PAGE SPEAKS TO EVERY SUPPLIER — AREA-VENDOR, 2026-09-19.
 *
 * The owner, as the supplier Saysay (a host-and-band shop, category
 * `band_dj`), with one contracted booking on the books: the focal tile said
 * "Your next shoot is on the books." and the countdown tile was headed
 * "Next shoot". A band does not shoot. Neither does a caterer, a florist, a
 * coordinator or a venue — and every one of them opens this page.
 *
 * Asserted on REAL MARKUP: both tiles are rendered with the owner's own case
 * (one booking, no inquiries), so the words tested are the words drawn —
 * never a source grep a reword could slip past.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import type { VendorEarningsSummary } from '@/lib/vendor-overview';

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

const booking = {
  id: 'up-e1-2026-10-30',
  eventId: 'e1',
  eventName: 'Rosa & Ben',
  date: '2026-10-30',
  place: 'Manila',
  category: 'band_dj',
  inDays: 41,
  href: '/vendor-dashboard/clients/e1',
};

async function render(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VendorTodayFocal, VendorEnergyStats } = await import('./overview-sections');
  return renderToStaticMarkup(
    React.createElement(
      'div',
      null,
      React.createElement(VendorTodayFocal, {
        businessName: 'Saysay Host and Band',
        inquiries: 0,
        nextBooking: booking,
        earnedThisYearPhp: null,
      }),
      React.createElement(VendorEnergyStats, {
        whatsNew: [],
        ongoing: [],
        upcoming: [booking],
        // `paydayMeasured` is the "the read was answered" flag S41 (#5650) adds;
        // carried here so this fixture means the same thing before and after it lands.
        earnings: {
          earnedThisYearPhp: 0,
          bookingCount: 0,
          confirmedPhp: 2000,
          expectedPhp: 10170,
          paydayMeasured: true,
          earningsMeasured: true,
        } as VendorEarningsSummary,
      }),
    ),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('a supplier with a booking is told about it — in words that fit every craft', async () => {
  const t = text(await render());
  // Floor: the tiles really rendered the booking (an empty render passes nothing).
  assert.match(t, /Rosa &amp; Ben|Rosa & Ben/, `the booking did not render: ${t.slice(0, 400)}`);
  assert.match(t, /on the books/, 'the focal headline for a booked shop did not render');
  const hit = t.match(CRAFT_WORDS);
  assert.equal(hit, null, `photographer-only word "${hit?.[0]}" on the every-supplier Today page: …${t.slice(Math.max(0, (hit?.index ?? 0) - 60), (hit?.index ?? 0) + 60)}…`);
});

test('the cash-flow tile shows the confirmed deposit against the booked total', async () => {
  const t = text(await render());
  assert.match(t, /Confirmed cash-flow/);
  assert.match(t, /₱2,000/);
  assert.match(t, /of ₱10,170 booked/);
  assert.doesNotMatch(t, /No booked installments yet/);
});
