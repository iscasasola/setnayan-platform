/**
 * 🛒 EVENT PRO AND EVENT ULTRA HAVE A DOOR IN THE iPHONE APP — measured on main 24 Nov, before the 1.0 (build 9) submit.
 *
 * Event services (`studio/website-pro`, owner 2026-11-23) is the ONE place an event buys Event Plus · Pro · Ultra. Its
 * iPhone face was built 22 Nov (StoreKit prices only, Apple's sheet per item) and Today drew its door where Apple
 * sells — but the route stayed refused in the store shell, so the door landed on /web-only and Event Pro and Event
 * Ultra could not be bought in the app at all: a submission carrying them fails review (2.1), and 3.1.3(b) needs every
 * plan the website sells sold here too. So:
 *
 *   1 · with the gate ON the route opens and Today's "Event services" door is a real way in; with it OFF nothing changes;
 *   2 · Schedule's Release (the Pro PLAN's, `eventProPlanActive`) opens Event services with Event Pro picked in the app —
 *       never /apple-pro, which sells Event Plus since 20 Nov (Plus does not release);
 *   3 · the server sells each plan to an event with no plan (one plan per event in the app) — and the page offers no
 *       pack to an event on a plan (the-app-offers-the-plans-pricing-offers.test.ts).
 *
 * 🛡 Sabotaged 2026-11-24, each red then restored (PR body): `website-pro` dropped from `IAP_OPENED_ROUTE` turns 1 red;
 * Release back to /apple-pro turns 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments';
import { isStoreShellWebOnlyPath, storeShellHidesHref } from '../store-shell';
import { routes } from '../routes';
import { IAP_PRODUCTS } from './products';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = '00000000-0000-4000-8000-000000000000';

test('1 · Event services opens where Apple sells, and only there', () => {
  const door = routes.dashboard.eventServices(E);
  assert.equal(isStoreShellWebOnlyPath(door, true), false, 'Event services is refused where Apple sells: Pro and Ultra have no door');
  assert.equal(isStoreShellWebOnlyPath(door, false), true, 'Event services opens in the app with the gate OFF (3.1.1)');
  assert.equal(isStoreShellWebOnlyPath(door), true);
  const here = `https://www.setnayan.com/dashboard/${E}`;
  assert.equal(storeShellHidesHref(`${door}?plan=pro`, here, true), false, 'the link guard hides the door where Apple sells');
  assert.equal(storeShellHidesHref(door, here, false), true);
  // Every plan the page sells is an Apple product the app carries.
  for (const code of ['EVENT_PLUS', 'COUPLE_WEBSITE_PRO', 'EVENT_ULTRA']) {
    assert.ok(IAP_PRODUCTS.some((p) => p.serviceKey === code), `${code} is sold on Event services but is no Apple product`);
  }
  // Today draws the door where Apple sells (and never in an app that sells nothing).
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /eventServices=\{storeShell && !appleFacts \? null : eventServicesTodayLine\(/);
  // The page itself still sends an app that cannot sell back to Today.
  assert.match(code('app/dashboard/[eventId]/studio/website-pro/page.tsx'), /if \(gate\.storeShell && !gate\.iap\) redirect\(`\/dashboard\/\$\{eventId\}`\);/);
});

test('2 · Release (the Pro plan) opens Event services with Event Pro picked in the app — never /apple-pro (Event Plus)', () => {
  for (const rel of ['lib/schedule-release.server.ts', 'lib/schedule-view-as.server.ts']) {
    const src = code(rel);
    assert.match(src, /proHref: gate\.iap\s*\? `\$\{routes\.dashboard\.eventServices\(eventId\)\}\?plan=pro`/, `${rel}: Release's app door`);
    assert.doesNotMatch(src, /apple-pro/, `${rel}: Release sells Event Plus, which does not release`);
  }
  assert.match(code('lib/schedule-release.server.ts'), /return await eventProPlanActive\(/, 'premise: Release is the Pro plan’s');
});

test('3 · the server sells a plan only to an event with no plan — one plan per event in the app', () => {
  const actions = code('lib/iap/iap-actions.ts');
  assert.match(actions, /if \(await eventOwnsSku\(admin, eventId, 'EVENT_PLUS'\)\) return startRefusal\('not_on_sale'\);/);
  assert.match(actions, /if \(own\.proPlan\) return startRefusal\('owned'\);/);
});
