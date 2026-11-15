/**
 * 🔢 THE SHOP'S PINNED ROW COUNTS CARDS AND LIVE CARDS — ONE UNIT (W1, 15 Nov 2026).
 *
 * Shop's pinned row read "3 cards · 2 live" while all 3 cards were online: "cards" summed each service's cards, "live"
 * counted SERVICES with a card on. Two services holding three live cards is "3 cards · 3 live".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardsLiveBits, shopServiceRows, type ShopCardLite } from './shop-services-summary';
import { stripComments } from './strip-comments';

const card = (id: string, cov: number, on: boolean): ShopCardLite => ({
  vendor_service_id: id,
  coverage_id: cov,
  category: 'catering',
  is_active: on,
  starting_price_php: 10_000,
});
const covs = [
  { id: 1, canonical_service: 'catering' },
  { id: 2, canonical_service: 'cake' },
];

test('1 · 2 services, 3 cards, all on → "3 cards · 3 live"', () => {
  const rows = shopServiceRows(covs, [card('a', 1, true), card('b', 1, true), card('c', 2, true)], (s) => s);
  assert.equal(rows.length, 2);
  assert.equal(cardsLiveBits(rows).join(' · '), '3 cards · 3 live');
});

test('2 · live counts the cards that are on, not the services that have one', () => {
  const rows = shopServiceRows(covs, [card('a', 1, true), card('b', 1, false), card('c', 2, true)], (s) => s);
  assert.equal(cardsLiveBits(rows).join(' · '), '3 cards · 2 live');
  assert.equal(cardsLiveBits(shopServiceRows(covs, [card('a', 1, false)], (s) => s)).join(' · '), '1 card', 'none on → no "0 live"');
  assert.deepEqual(cardsLiveBits(null), [], 'an unread list is not "0 cards"');
});

test('3 · the shop page words its pinned row through cardsLiveBits, never by counting services', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/shop/page.tsx'), 'utf8'));
  const fn = page.slice(page.indexOf('function servicesCompact'), page.indexOf('function cardsOf'));
  assert.match(fn, /cardsLiveBits\(d\.serviceRows\)/, 'the pinned row no longer reads cardsLiveBits');
  assert.doesNotMatch(fn, /\.filter\(\(r\) => r\.live\)/, 'the pinned row counts live SERVICES beside a count of cards');
});
