/**
 * each-supplier-page-has-its-tour.test.ts — 🔦 SHOP · DATES · MONEY · HUB each meet a first-visit
 * spotlight (owner "Yes to all", 2026-10-22; `prototypes/journey_fixes_2026-10-22.html` § Supplier 3).
 *
 * Held as properties, not phrasings:
 *   1 · each of the four is a SPOTLIGHT with the drawn number of stops, on the drawn anchors, in order;
 *   2 · none repeats a stop the Today journey (`supplier_spotlight_v1`) already makes;
 *   3 · the address decides which one is on screen — and a page that is not one of the four gets none;
 *   4 · none plays before the Today journey is seen, none twice, none on a failed read;
 *   5 · mounted ONCE, in the supplier layout — never in the couple tree the Maker loads under;
 *   6 · the words keep the house rules, and the free-booking count is the fee engine's own number.
 *
 * SABOTAGE (each seen red before this shipped — PR body has the runs): a Money stop dropped → 1 ·
 * `/customers` People mapped to Dates → 3 · `supplierPageToursDue` ignoring the Today journey → 4 ·
 * the mount added to the couple layout → 5 · "Your first 5" typed into the Money tour → 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { TOURS, TOUR_KEYS } from '@/lib/tours';
import { FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';
import {
  SUPPLIER_PAGE_TOURS,
  SUPPLIER_PAGE_TOURS_AFTER,
  supplierPageTourOn,
  supplierPageToursDue,
} from '@/lib/supplier-page-tours';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

/** The drawn stops, prototype word for word on the anchors (§ Supplier 3). */
const DRAWN: Record<(typeof SUPPLIER_PAGE_TOURS)[number], string[]> = {
  vendor_shop_v1: ['shop-segments', 'shop-page-list', 'shop-details-row'],
  vendor_dates_v1: ['dates-calendar', 'dates-check', 'dates-add'],
  vendor_money_v1: ['money-summary', 'money-next', 'money-log', 'money-fees'],
  // Reading order since 2026-10-25 (the next events sit above the quiet day's panel), + the event day's own stop.
  vendor_hub_v1: ['hub-next-days', 'hub-empty', 'hub-day-launch', 'hub-setup'],
  // + Owner 2026-10-25, "the spotlight tour is missing so many parts for each page".
  vendor_today_v2: ['supplier-messages', 'today-numbers', 'today-coming-up', 'today-shop'],
  vendor_people_v1: ['customers-segments', 'customers-filter', 'customers-search', 'customers-add'],
  vendor_collections_v1: ['collections-filter', 'collections-list', 'collections-add'],
};

test('1 · each page tour is a spotlight with the drawn stops, in order', () => {
  assert.deepEqual([...SUPPLIER_PAGE_TOURS].sort(), Object.keys(DRAWN).sort(), 'the page tours changed');
  for (const key of SUPPLIER_PAGE_TOURS) {
    assert.ok(TOUR_KEYS.includes(key), `${key} is not in TOUR_KEYS — completeTour would refuse to record it`);
    const s = TOURS[key].spotlight;
    assert.ok(s, `${key} has no spotlight script — it would never run`);
    assert.deepEqual(s.steps.map((x) => x.anchor), DRAWN[key], `${key}: not the drawn stops`);
    assert.ok(s.finale.title.startsWith('You’re set'), `${key}: the finale is not the shipped "You're set"`);
  }
  // The Shop tour's first stop is the doorway into Page.
  assert.equal(TOURS.vendor_shop_v1.spotlight!.steps[0]!.go, true, 'Shop stop 1 no longer walks into Page');
});

test('2 · no page tour repeats a stop the Today journey makes', () => {
  const today = new Set(TOURS[SUPPLIER_PAGE_TOURS_AFTER].spotlight!.steps.map((x) => x.anchor));
  assert.ok(today.size >= 6, 'anti-vacuity: the Today journey has no stops');
  for (const key of SUPPLIER_PAGE_TOURS) {
    const again = TOURS[key].spotlight!.steps.map((x) => x.anchor).filter((a) => today.has(a));
    assert.deepEqual(again, [], `${key} repeats the Today journey's stops`);
  }
});

test('3 · the address decides which tour is on screen', () => {
  const on = (p: string, q: Record<string, string> = {}) => supplierPageTourOn(p, q);
  for (const p of ['/vendor-dashboard/shop', '/vendor-dashboard/website', '/vendor-dashboard/profile', '/vendor-dashboard/performance']) {
    assert.equal(on(p), 'vendor_shop_v1', `${p} is a Shop segment`);
  }
  // Since 2026-10-25 Today, Customers › People and Your collections have their own (the albums sub-page none).
  assert.equal(on('/vendor-dashboard'), 'vendor_today_v2');
  assert.equal(on('/vendor-dashboard/customers'), 'vendor_people_v1');
  assert.equal(on('/vendor-dashboard/customers', { seg: 'people' }), 'vendor_people_v1');
  assert.equal(on('/vendor-dashboard/collections'), 'vendor_collections_v1');
  assert.equal(on('/vendor-dashboard/customers', { seg: 'dates' }), 'vendor_dates_v1');
  assert.equal(on('/vendor-dashboard/customers', { open: 'calendar' }), 'vendor_dates_v1', 'an old Dates landing');
  assert.equal(on('/vendor-dashboard/customers', { seg: 'money' }), 'vendor_money_v1');
  assert.equal(on('/vendor-dashboard/customers', { open: 'payday' }), 'vendor_money_v1', 'an old Money landing');
  assert.equal(on('/vendor-dashboard/on-the-day'), 'vendor_hub_v1');
  for (const p of ['/vendor-dashboard/collections/albums', '/vendor-dashboard/shopping', '/dashboard', '/vendor-dashboard/on-the-day/live']) {
    assert.equal(on(p), null, `${p} draws a page tour that is not its own`);
  }
});

test('4 · none before the Today journey, none twice, none on a failed read', () => {
  assert.deepEqual(supplierPageToursDue(null), [], 'a failed read replays tours');
  assert.deepEqual(supplierPageToursDue([]), [], 'a page tour stacks on the Today journey');
  assert.deepEqual(supplierPageToursDue([SUPPLIER_PAGE_TOURS_AFTER]), [...SUPPLIER_PAGE_TOURS]);
  assert.deepEqual(
    supplierPageToursDue([SUPPLIER_PAGE_TOURS_AFTER, 'vendor_money_v1']),
    SUPPLIER_PAGE_TOURS.filter((k) => k !== 'vendor_money_v1'),
    'a finished tour plays again',
  );
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('5 · mounted once, in the supplier layout — never under the couple tree', () => {
  const files = walk(join(WEB, 'app'));
  const mounts = files.filter((f) => /<SupplierPageSpotlight\b/.test(stripComments(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f));
  assert.deepEqual(mounts, ['app/vendor-dashboard/layout.tsx'], 'the page tours are mounted somewhere else too');
  const importers = files
    .filter((f) => /supplier-page-spotlight/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f))
    .filter((f) => !f.startsWith('app/vendor-dashboard/'));
  assert.deepEqual(importers, [], 'a file outside the supplier tree imports the page tours — the Maker’s first load could carry them');
  // Each tour is no longer mounted page by page (a page mount dies when Shop walks into Page).
  for (const key of SUPPLIER_PAGE_TOURS) {
    const literal = files.filter((f) => new RegExp(`tourKey="${key}"`).test(stripComments(readFileSync(f, 'utf8'))));
    assert.deepEqual(literal, [], `${key} is mounted page by page again`);
  }
});

test('6 · the words keep the house rules; the free booking is the fee engine’s sentence', () => {
  for (const key of SUPPLIER_PAGE_TOURS) {
    const s = TOURS[key].spotlight!;
    const words = [TOURS[key].label, TOURS[key].blurb, ...s.steps.flatMap((x) => [x.title, x.body]), s.finale.title, s.finale.body].join(' ');
    assert.doesNotMatch(words, /\bvendor|celebration|website/i, `${key} uses a retired word`);
    assert.doesNotMatch(words, /₱|PHP\s?\d/, `${key} names a price — prices come from the catalogue, never a tour`);
    assert.doesNotMatch(words, /&[a-z#0-9]+;/, `${key}: spotlight words are plain text — an entity prints literally`);
  }
  const fee = TOURS.vendor_money_v1.spotlight!.steps.find((x) => x.anchor === 'money-fees')!.body;
  // ⚖ One free booking (owner 2026-10-23) — the tour says the fee engine's own sentence.
  assert.ok(fee.includes(FIRST_BOOKING_ON_US), 'the Money tour does not say the fee engine’s free-booking sentence');
  const src = readFileSync(join(WEB, 'lib', 'tours.ts'), 'utf8');
  assert.match(src, /\$\{FIRST_BOOKING_ON_US\}/, 'the free booking is typed into the tour instead of read from the fee engine');
});
