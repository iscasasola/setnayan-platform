/**
 * customer-menu.test.ts — the phone's ONE bottom bar: Home · Guests · Your
 * Team · More (owner 2026-09-30, "the menu changes also on the mobile view";
 * DECISION_LOG "THE PHONE MENU IS THE SAME FOUR"), the same four in every
 * phase, gated only by the event type. The Maker is reached from Home.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerMenuTree } from './customer-menu';
import { SUITE_NAV_ON } from './studio-hub';

const EVENT_ID = 'evt-test';
const BASE = `/dashboard/${EVENT_ID}`;

/** The event's Studio products as the layout hands them over (plain data). */
const STUDIO = [
  { key: 'papic', href: `${BASE}/studio/papic`, name: 'Papic' },
  { key: 'mood-board', href: `${BASE}/studio/mood-board`, name: 'Mood Board' },
];

const FOUR = ['home', 'guests', 'explore', 'studio'];

test('the bar is the owner’s four, in the owner’s order, in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const tree = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO });
    assert.deepEqual(tree.map((m) => m.key), FOUR, `${phase}: the bar rearranged itself`);
    // The phone bar's one short word (owner 2026-09-30: "More").
    assert.deepEqual(
      tree.map((m) => m.label),
      ['Home', 'Guests', 'Your Team', SUITE_NAV_ON ? 'More' : 'Studio'],
    );
  }
});

test('a product is never a tab — Papic is a card on Our Services', () => {
  const withProducts = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true, studioRows: STUDIO });
  const without = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true });
  assert.deepEqual(withProducts.map((m) => m.key), without.map((m) => m.key));
  // …but a product page still lights the tab that holds it.
  const studio = withProducts.find((m) => m.key === 'studio')!;
  assert.ok((studio.activeMatch as string[]).includes(`${BASE}/studio/papic`));
  // Mood Board lives in the Maker's Details; on the phone the Maker's pages light Home.
  const home = withProducts.find((m) => m.key === 'home')!;
  assert.ok((home.activeMatch as string[]).includes(`${BASE}/studio/mood-board`), 'Mood Board lights no tab');
});

test('hideKeys drops Your Team for a vendor-free kind — in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const keys = buildCustomerMenuTree(EVENT_ID, { phase, hideKeys: ['explore'], websiteEnabled: true }).map((m) => m.key);
    assert.deepEqual(keys, ['home', 'guests', 'studio']);
  }
  // Empty hideKeys is a no-op.
  assert.deepEqual(
    buildCustomerMenuTree(EVENT_ID, { hideKeys: [], websiteEnabled: true }).map((m) => m.key),
    FOUR,
  );
});

test('no Event Hub for this kind → no Maker tab, and its pages light Our Services', () => {
  const tree = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: false, studioRows: STUDIO });
  assert.deepEqual(tree.map((m) => m.key), ['home', 'guests', 'explore', 'studio']);
  const studio = tree.find((m) => m.key === 'studio')!.activeMatch as string[];
  for (const p of ['/schedule', '/story', '/studio/mood-board']) {
    assert.ok(studio.includes(`${BASE}${p}`), `${p} lights nothing where there is no Maker`);
  }
});

test('each tab lights the pages it now holds', () => {
  const tree = buildCustomerMenuTree(EVENT_ID, {
    websiteEnabled: true,
    seatingEnabled: true,
    studioRows: [...STUDIO, { key: 'pa3d', href: `${BASE}/seating/lab`, name: '3D Plan' }],
  });
  const lit = (key: string) => tree.find((m) => m.key === key)!.activeMatch as string[];
  // Guests: Hosts, the event QR, People.
  for (const p of ['/guests', '/hosts', '/event-qr', '/people']) {
    assert.ok(lit('guests').includes(`${BASE}${p}`), `Guests does not light ${p}`);
  }
  assert.ok(lit('explore').includes(`${BASE}/budget`), 'Your Team does not light /budget');
  // The Maker has no tab on the phone — its pages, and the Seat plan (Details ›
  // Your event › Seat plan) with its 3D view, light Home, where it is reached.
  assert.ok(!tree.some((m) => m.key === 'launch'), 'the Maker is a phone tab again');
  for (const p of ['/launch', '/website', '/story', '/schedule', '/seating', '/plan3d']) {
    assert.ok(lit('home').includes(`${BASE}${p}`), `Home does not light ${p}`);
  }
  assert.ok(lit('studio').includes(`${BASE}/galleries`), 'Our Services does not light Galleries');
});

test('Home lights itself and its checklist EXACTLY — and the Maker’s pages', () => {
  const home = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true })[0]!;
  assert.equal(home.key, 'home');
  // Its own two pages are exact (every event route shares `${BASE}/`)…
  assert.deepEqual(home.activeMatchAlsoExact, [BASE, `${BASE}/checklist`]);
  assert.ok(!(home.activeMatch as string[]).includes(BASE), 'Home would light every event page');
  // …and with no Maker for this kind it lights only those two.
  const bare = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: false })[0]!;
  assert.equal(bare.activeMatchExact, true);
  assert.deepEqual(bare.activeMatch, [BASE, `${BASE}/checklist`]);
});

test('after the day, Your Team opens on the suppliers who worked it (the shipped deep link)', () => {
  const after = buildCustomerMenuTree(EVENT_ID, { phase: 'after', websiteEnabled: true });
  assert.equal(after.find((m) => m.key === 'explore')!.href, `${BASE}/vendors?tab=build`);
  const plan = buildCustomerMenuTree(EVENT_ID, { phase: 'plan', websiteEnabled: true });
  assert.equal(plan.find((m) => m.key === 'explore')!.href, `${BASE}/vendors`);
});
