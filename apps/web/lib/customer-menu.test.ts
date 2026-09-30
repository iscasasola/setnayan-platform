/**
 * customer-menu.test.ts — the phone's ONE bottom bar (Stage D, owner
 * 2026-09-29): Home · Guest list · Your Team · Event Hub Maker · Our Services,
 * the same five in every phase, gated only by the event type.
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

const FIVE = ['home', 'guests', 'explore', 'launch', 'studio'];

test('the bar is the owner’s five, in the owner’s order, in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const tree = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO });
    assert.deepEqual(tree.map((m) => m.key), FIVE, `${phase}: the bar rearranged itself`);
    // The phone bar's short words (owner 2026-09-29: "Maker and Services").
    assert.deepEqual(
      tree.map((m) => m.label),
      ['Home', 'Guest list', 'Your Team', 'Maker', SUITE_NAV_ON ? 'More' : 'Studio'],
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
  const maker = withProducts.find((m) => m.key === 'launch')!;
  assert.ok((maker.activeMatch as string[]).includes(`${BASE}/studio/mood-board`), 'Mood Board lives in Details');
});

test('hideKeys drops Your Team for a vendor-free kind — in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const keys = buildCustomerMenuTree(EVENT_ID, { phase, hideKeys: ['explore'], websiteEnabled: true }).map((m) => m.key);
    assert.deepEqual(keys, ['home', 'guests', 'launch', 'studio']);
  }
  // Empty hideKeys is a no-op.
  assert.deepEqual(
    buildCustomerMenuTree(EVENT_ID, { hideKeys: [], websiteEnabled: true }).map((m) => m.key),
    FIVE,
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
  // Guest list: Hosts, the event QR, People.
  for (const p of ['/guests', '/hosts', '/event-qr', '/people']) {
    assert.ok(lit('guests').includes(`${BASE}${p}`), `Guest list does not light ${p}`);
  }
  assert.ok(lit('explore').includes(`${BASE}/budget`), 'Your Team does not light /budget');
  // The Maker — and the Seat plan (Details › Your event › Seat plan, train n)
  // with its 3D view.
  for (const p of ['/launch', '/website', '/story', '/schedule', '/seating', '/plan3d']) {
    assert.ok(lit('launch').includes(`${BASE}${p}`), `the Maker does not light ${p}`);
  }
  assert.ok(lit('studio').includes(`${BASE}/galleries`), 'Our Services does not light Galleries');
});

test('Home lights only itself (and its own checklist)', () => {
  const home = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true })[0]!;
  assert.equal(home.key, 'home');
  assert.equal(home.activeMatchExact, true);
  assert.deepEqual(home.activeMatch, [BASE, `${BASE}/checklist`]);
});

test('after the day, Your Team opens on the suppliers who worked it (the shipped deep link)', () => {
  const after = buildCustomerMenuTree(EVENT_ID, { phase: 'after', websiteEnabled: true });
  assert.equal(after.find((m) => m.key === 'explore')!.href, `${BASE}/vendors?tab=build`);
  const plan = buildCustomerMenuTree(EVENT_ID, { phase: 'plan', websiteEnabled: true });
  assert.equal(plan.find((m) => m.key === 'explore')!.href, `${BASE}/vendors`);
});
