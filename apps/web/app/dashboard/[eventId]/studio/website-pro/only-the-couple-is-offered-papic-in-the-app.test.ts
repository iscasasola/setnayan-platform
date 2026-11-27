/**
 * 📸 ONLY THE COUPLE IS OFFERED PAPIC IN THE APP (live fault, 27 Nov 2026).
 *
 * `startAppStorePurchase` sells Papic credits to `member_type = 'couple'` only, but Event services showed the photo buy
 * to every member — a co-host (stored as 'coordinator') was offered a buy Apple's sheet never opened for. Now the page
 * hands a non-couple the existing refusal line instead of the sizes. The server rule is unchanged.
 *
 * Executed: the real view rendered with and without the line; the page's wiring held by source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventServicesView } from './_components/event-services-view';
import { startRefusalLine } from '@/lib/iap/iap-outcome';
import { stripComments } from '@/lib/strip-comments';
import type { EventServicesFacts } from '@/lib/event-services';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));

const facts: EventServicesFacts = {
  eyebrow: 'Ana & Miguel · Sat 12 Dec 2026',
  plan: 'free',
  planName: 'Free',
  photosLeft: 151,
  packs: [],
  singles: [{ key: 'live', code: 'LIVE_STUDIO', php: 3333, state: 'buy' }],
  photos: [{ code: 'PAPIC_GUEST_1K', points: 1000, php: 444 }],
} as unknown as EventServicesFacts;

const draw = (papicRefusal: string | null) =>
  renderToStaticMarkup(
    React.createElement(EventServicesView, {
      eventId: 'EVENT',
      facts,
      ordersHref: '/dashboard/EVENT/orders',
      initialOpen: true,
      lab: true,
      papicRefusal,
    }),
  );

const COUPLE_ONLY = startRefusalLine('couple_only');

test('the couple sees the photo sizes', () => {
  const html = draw(null);
  assert.match(html, /data-event-services-photos=""/);
  assert.match(html, /Photo sizes/);
  assert.doesNotMatch(html, /data-event-services-photos-refused/);
});

test('a non-couple member sees the plain refusal line, never a size to buy', () => {
  const html = draw(COUPLE_ONLY);
  assert.match(html, /data-event-services-photos-refused=""/);
  assert.ok(html.includes(COUPLE_ONLY.replace(/'/g, '&#x27;')) || html.includes(COUPLE_ONLY));
  assert.doesNotMatch(html, /Photo sizes/, 'no size chips');
  assert.doesNotMatch(html, /pick a size/);
});

test('the page refuses a non-couple in the app with the server’s own words, and drops Papic from StoreKit', () => {
  const src = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(src, /\.from\('event_members'\)[\s\S]*?\.select\('member_type'\)/);
  assert.match(src, /=== 'couple'/);
  assert.match(src, /startRefusalLine\('couple_only'\)/);
  assert.match(src, /appleProductsFor\(coupleHere === true\)/);
  assert.match(src, /if \(withPapic\) for \(const p of IAP_PAPIC_PRODUCTS\)/);
  assert.match(src, /papicRefusal=\{papicRefusal\}/);
  // The server rule this mirrors is unchanged.
  const actions = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '..', 'lib', 'iap', 'iap-actions.ts'), 'utf8'));
  assert.match(actions, /product\.kind === 'papic-credits' && \(membership as \{ member_type\?: string \}\)\.member_type !== 'couple'/);
});
