/**
 * customer-menu.test.ts — the phone's ONE bottom bar (Stage D, owner
 * 2026-09-29), now Home · Guests · Suppliers · Hub — the same four in every
 * phase, web and app (owner 22 Oct 2026, *"Yes remove more"*). Home holds what
 * More held (the services live on Home › Your services).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerMenuTree } from './customer-menu';

const EVENT_ID = 'evt-test';
const BASE = `/dashboard/${EVENT_ID}`;

/** The event's Studio products as the layout hands them over (plain data). */
const STUDIO = [
  { key: 'papic', href: `${BASE}/studio/papic`, name: 'Papic' },
  { key: 'mood-board', href: `${BASE}/studio/mood-board`, name: 'Mood Board' },
];

const FOUR = ['home', 'guests', 'explore', 'launch'];

test('the bar is the owner’s four, in the owner’s order, in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const tree = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO });
    assert.deepEqual(tree.map((m) => m.key), FOUR, `${phase}: the bar rearranged itself`);
    // The rail's words (owner 2026-10-01 "Home - Guests - Suppliers - Hub", More gone 22 Oct 2026).
    assert.deepEqual(tree.map((m) => m.label), ['Home', 'Guests', 'Suppliers', 'Hub']);
  }
});

test('a product is never a tab — Papic is a row on Home › Your services', () => {
  const withProducts = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true, studioRows: STUDIO });
  const without = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true });
  assert.deepEqual(withProducts.map((m) => m.key), without.map((m) => m.key));
  // …but a product page still lights the tab that holds it.
  const home = withProducts.find((m) => m.key === 'home')!;
  assert.ok((home.activeMatch as string[]).includes(`${BASE}/studio/papic`), 'Papic’s page lights nothing');
  const maker = withProducts.find((m) => m.key === 'launch')!;
  assert.ok((maker.activeMatch as string[]).includes(`${BASE}/studio/mood-board`), 'Mood Board lives in Details');
});

test('hideKeys drops Your Team for a vendor-free kind — in every phase', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const keys = buildCustomerMenuTree(EVENT_ID, { phase, hideKeys: ['explore'], websiteEnabled: true }).map((m) => m.key);
    assert.deepEqual(keys, ['home', 'guests', 'launch']);
  }
  // Empty hideKeys is a no-op.
  assert.deepEqual(
    buildCustomerMenuTree(EVENT_ID, { hideKeys: [], websiteEnabled: true }).map((m) => m.key),
    FOUR,
  );
});

test('no Event Hub for this kind → no Maker tab, and its pages light Home', () => {
  const tree = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: false, studioRows: STUDIO });
  assert.deepEqual(tree.map((m) => m.key), ['home', 'guests', 'explore']);
  const home = tree.find((m) => m.key === 'home')!.activeMatch as string[];
  for (const p of ['/schedule', '/story', '/studio/mood-board']) {
    assert.ok(home.includes(`${BASE}${p}`), `${p} lights nothing where there is no Maker`);
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
  assert.ok(lit('home').includes(`${BASE}/galleries`), 'Home does not light Galleries');
});

test('Home lights itself and its checklist EXACTLY, and only the service pages it holds by prefix', () => {
  const home = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true })[0]!;
  assert.equal(home.key, 'home');
  assert.deepEqual(home.activeMatchAlsoExact, [BASE, `${BASE}/checklist`]);
  assert.ok(!(home.activeMatch as string[]).includes(BASE), 'Home claims every event page by prefix');
  assert.deepEqual(home.activeMatch, [`${BASE}/studio`, `${BASE}/galleries`]);
});

test('after the day, Your Team opens on the suppliers who worked it (the shipped deep link)', () => {
  const after = buildCustomerMenuTree(EVENT_ID, { phase: 'after', websiteEnabled: true });
  assert.equal(after.find((m) => m.key === 'explore')!.href, `${BASE}/vendors?tab=build`);
  const plan = buildCustomerMenuTree(EVENT_ID, { phase: 'plan', websiteEnabled: true });
  assert.equal(plan.find((m) => m.key === 'explore')!.href, `${BASE}/vendors`);
});
