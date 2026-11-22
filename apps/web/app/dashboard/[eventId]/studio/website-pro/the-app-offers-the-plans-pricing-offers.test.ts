/**
 * 💰 F-W2-29 (2026-11-13) → 🛒 EVENT SERVICES (owner 2026-11-23, v4 "Yes, build it"): inside the app a couple is offered
 * the SAME plans /pricing offers — now as PACKS on the one Event services page — each price and its included photos
 * READ (the catalogue rows, through the front door's own helpers and the charge authority).
 *
 * Executed, not grepped: the real component is rendered with facts handed in, and must show exactly those — and say
 * "Couldn't read" where a row did not read, never ₱0 and never a remembered figure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventServicesView } from './_components/event-services-view';
import { planCreditsFrom, planPricesFrom, PLAN_PRICE_CODES } from '@/lib/event-plans';
import { stripComments } from '@/lib/strip-comments';
import type { EventServicesFacts, EventServicesPick, PackFact } from '@/lib/event-services';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));

/* TEST INPUTS — odd figures on purpose, so a match can only come from what was handed in. */
const pack = (key: PackFact['key'], php: number | null, credits: number | null, over: Partial<PackFact> = {}): PackFact => ({
  key,
  code: PLAN_PRICE_CODES[key],
  name: key === 'plus' ? 'Event Plus' : key === 'pro' ? 'Event Pro' : 'Event Ultra',
  credits,
  addsCredits: credits,
  php,
  upgrade: false,
  state: 'buy',
  savePhp: null,
  fits: null,
  info: ['Everything in Event Plus'],
  ...over,
});
const facts = (over: Partial<EventServicesFacts> = {}): EventServicesFacts => ({
  eyebrow: 'Ana & Miguel · Sat 12 Dec 2026',
  plan: 'free',
  planName: 'Free',
  photosLeft: 151,
  packs: [pack('plus', 1234, 4321, { savePhp: 77 }), pack('pro', 2345, 8765, { fits: 'Fits: 11 suppliers booked.' }), pack('ultra', 5678, 3456)],
  singles: [
    { key: 'hub', code: 'EVENT_HUB', php: 1111, state: 'buy' },
    { key: 'ai', code: 'SETNAYAN_AI', php: 2222, state: 'buy' },
    { key: 'live', code: 'LIVE_STUDIO', php: 3333, state: 'buy' },
  ],
  photos: [{ code: 'PAPIC_GUEST_1K', points: 1000, php: 444 }],
  ...over,
});
const draw = (f: EventServicesFacts, initialPick?: EventServicesPick, initialOpen = false) =>
  renderToStaticMarkup(
    React.createElement(EventServicesView, { eventId: 'EVENT', facts: f, ordersHref: '/dashboard/EVENT/orders', initialPick, initialOpen, lab: true }),
  );

test('Free: your plan, then every pack with the price, photos and saving the reads handed in', () => {
  const html = draw(facts());
  assert.match(html, /data-event-services-plan="free"/);
  assert.match(html, /Your plan/);
  assert.match(html, /151 guest photos left/);
  for (const k of ['plus', 'pro', 'ultra']) assert.match(html, new RegExp(`data-event-services-pack="${k}"`));
  assert.match(html, /₱1,234/, 'the Plus price read from the row');
  assert.match(html, /4,321 photos/, 'the Plus photos read from the row');
  assert.match(html, /Save ₱77/, 'the saving handed in');
  assert.match(html, /Fits: 11 suppliers booked\./);
  assert.match(html, /Pick a pack/);
  assert.match(html, /Or just what you need/);
});

test('an unread row says “Couldn’t read” — never a remembered price, never ₱0', () => {
  const html = draw(facts({ packs: [pack('plus', null, null), pack('pro', 2345, 8765), pack('ultra', 5678, 3456)], photosLeft: null, planName: null, plan: null }));
  assert.match(html, /Couldn’t read/);
  assert.match(html, /Guest photos left: couldn’t read/);
  assert.doesNotMatch(html, /₱0(?![\d,])/);
});

test('on Event Pro only the next pack shows, the add-ons are open, and what the plan holds reads “In your plan”', () => {
  const html = draw(
    facts({
      plan: 'pro',
      planName: 'Event Pro',
      packs: [pack('plus', null, 4321, { state: 'yours' }), pack('pro', null, 8765, { state: 'yours' }), pack('ultra', 999, 3456, { addsCredits: 3000, upgrade: true })],
    }),
  );
  assert.match(html, /Next pack/);
  assert.doesNotMatch(html, /data-event-services-pack="plus"/, 'Pro holds everything in Plus — Plus is not sold');
  assert.match(html, /data-event-services-pack="ultra"/);
  assert.match(html, /pay the difference/);
  assert.match(html, /Adds Live Watch · 3,000 more photos/);
  assert.match(html, /data-event-services-singles="open"/);
  assert.equal((html.match(/In your plan/g) ?? []).length, 2, 'Event Hub and Setnayan AI read “In your plan”');
});

test('a picked pack and add-ons: one cart bar label, one Pay — never a second checkout', () => {
  const html = draw(facts(), { pack: 'pro', singles: ['live'], photos: 'PAPIC_GUEST_1K' }, true);
  assert.match(html, /data-event-services-pack="pro" data-picked=""/);
  assert.match(html, /After this: <span[^>]*>9,916 photos/, '151 + 8,765 + 1,000');
  assert.doesNotMatch(html, /InlineCheckoutDrawer|data-buy-/);
});

test('the page reads its packs through the one reader, priced by the charge authority, from the customer catalogue', () => {
  const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(page, /readEventServices\(eventId\)/);
  const reader = stripComments(readFileSync(join(HERE, '../../../../../lib/event-services.server.ts'), 'utf8'));
  assert.match(reader, /fetchV2CustomerCatalog\(\)/);
  assert.match(reader, /resolveOrderChargeCentavos\(\{ serviceKey, eventId \}\)/);
  assert.deepEqual(PLAN_PRICE_CODES, { plus: 'EVENT_PLUS', pro: 'COUPLE_WEBSITE_PRO', ultra: 'EVENT_ULTRA' });
  const rows = [
    { service_code: 'EVENT_PLUS', retail_price_php: 10, included_papic_credits: 20 },
    { service_code: 'COUPLE_WEBSITE_PRO', retail_price_php: 30, included_papic_credits: 40 },
    { service_code: 'EVENT_ULTRA', retail_price_php: 50, included_papic_credits: 60 },
  ];
  assert.deepEqual(planPricesFrom(rows), { plus: 10, pro: 30, ultra: 50 });
  assert.deepEqual(planCreditsFrom(rows), { plusCredits: 20, proCredits: 40, ultraCredits: 60 });
});
