/**
 * 🔒 WHAT YOU BOOK IS YOUR PRICE — AND THE APP SAYS SO ON BOTH SIDES (DECISION_LOG 2026-11-10, Build 5 Lane C).
 *
 * Measured before this build: the rule stood, no screen said it. This holds the two lines to their one home
 * (`lib/booked-price-words.ts`) and to the two screens that must say them, and the rule of when the Card Maker says it.
 * The database half — a card price edit never rewrites a booking — is `tests/db/a-card-price-edit-never-rewrites-a-booking.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOOKED_PRICE_STAYS_COUPLE,
  BOOKED_PRICE_STAYS_SUPPLIER,
  saysBookedPriceStays,
} from './booked-price-words';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const EDIT_PAGE = read('app/vendor-dashboard/services/[serviceId]/page.tsx');
const BOOKED = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');

test('the two lines say the owner’s rule, word for word', () => {
  assert.equal(BOOKED_PRICE_STAYS_SUPPLIER, 'Couples who already booked keep their price. New bookings use the new price.');
  assert.equal(BOOKED_PRICE_STAYS_COUPLE, 'Your price is set at booking. It changes only if you accept a change.');
});

test('the Card Maker says it on a booked card — and on an unread count, never hiding behind a failed read', () => {
  assert.equal(saysBookedPriceStays(3), true);
  assert.equal(saysBookedPriceStays(null), true, 'an unread booking count must not read as "nobody booked"');
  assert.equal(saysBookedPriceStays(0), false, 'a card nobody booked has no one to keep a price');
});

test('the Card Maker’s price row draws the supplier line from the one home', () => {
  assert.match(MAKER, /import \{ BOOKED_PRICE_STAYS_SUPPLIER, saysBookedPriceStays \} from '@\/lib\/booked-price-words';/);
  const price = MAKER.slice(MAKER.indexOf('data-maker-row="price"'), MAKER.indexOf('data-maker-price-more'));
  assert.match(price, /editing && bookedNow !== undefined && saysBookedPriceStays\(bookedNow\)/, 'the line left the price row, or lost its rule');
  assert.match(price, /data-booked-price-stays=""[\s\S]{0,40}\{BOOKED_PRICE_STAYS_SUPPLIER\}/);
  // The edit page measures it with its own read (null on a refusal), never the fail-soft records map.
  assert.match(EDIT_PAGE, /readCardBookedCount\(supabase, serviceId\)/);
  assert.match(EDIT_PAGE, /bookedNow=\{bookedNow\}/);
});

test('Suppliers › Booked draws the couple line on a Setnayan supplier booked at a price, never a self-added one', () => {
  assert.match(BOOKED, /import \{ BOOKED_PRICE_STAYS_COUPLE \} from '@\/lib\/booked-price-words';/);
  assert.match(BOOKED, /\{!row\.own && row\.money \? \(\s*<p[^>]*data-booked-price-stays=""[^>]*>\s*\{BOOKED_PRICE_STAYS_COUPLE\}/);
});

test('the words are never typed twice', () => {
  for (const [name, src] of [
    ['canvas-maker.tsx', MAKER],
    ['booked-row.tsx', BOOKED],
  ] as const) {
    assert.ok(!src.includes('keep their price'), `${name} types the supplier line instead of importing it`);
    assert.ok(!src.includes('set at booking'), `${name} types the couple line instead of importing it`);
  }
});
