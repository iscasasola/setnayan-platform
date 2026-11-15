/**
 * 🧾🏦 THE CLAIM DOOR PRICES WHAT WAS AGREED, AND KEEPS HOW THEY ARE PAID (price basis v2, owner 2026-11-13).
 * The card slide posts the Card Maker's own fields; the finish hands the SHIPPED `createVendorService` exactly those
 * fields (`claimCardServiceFields`); per hour without an extra-hour price is refused on the door; the payment details
 * the supplier confirmed survive the post's re-read. Test values only.
 *
 * Run (from apps/web): tsx --test lib/the-claim-door-prices-what-was-agreed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { claimCardServiceFields, claimPricingMissing, parseClaimDoorAnswers, type ClaimCardPricing } from './claim-door';

const P = (p: Partial<ClaimCardPricing>): ClaimCardPricing => ({
  basis: 'fixed',
  perPax: null,
  minPax: null,
  minHours: null,
  hourBase: null,
  extraHour: null,
  extras: [],
  ...p,
});

test('One price → From (PHP) + Extras as the maker’s add-on rows', () => {
  assert.deepEqual(claimCardServiceFields({ price: 80000, pricing: P({ extras: [{ name: 'Extra hour of coverage', price: 5000 }, { name: ' ', price: 1 }] }) }), [
    ['pricing_basis', 'fixed'],
    ['starting_price_php', '80000'],
    ['addons_present', '1'],
    ['addon_label', 'Extra hour of coverage'],
    ['addon_price', '5000'],
  ]);
  // A card from before v2 (no pricing) is the shipped One price.
  assert.deepEqual(claimCardServiceFields({ price: 45000 }), [
    ['pricing_basis', 'fixed'],
    ['starting_price_php', '45000'],
  ]);
  assert.equal(claimCardServiceFields({ price: null }), null, 'no price → no card, as before');
});

test('Per guest → per_pax_price_php + min_pax; Per hour → hour_base_php + min_hours + extra_hour_php', () => {
  assert.deepEqual(claimCardServiceFields({ price: 162000, pricing: P({ basis: 'per_pax', perPax: 1350, minPax: 120 }) }), [
    ['pricing_basis', 'per_pax'],
    ['per_pax_price_php', '1350'],
    ['min_pax', '120'],
  ]);
  assert.deepEqual(claimCardServiceFields({ price: 30000, pricing: P({ basis: 'per_hour', minHours: 5, hourBase: 30000, extraHour: 6500 }) }), [
    ['pricing_basis', 'per_hour'],
    ['hour_base_php', '30000'],
    ['min_hours', '5'],
    ['extra_hour_php', '6500'],
  ]);
  assert.equal(claimCardServiceFields({ price: 162000, pricing: P({ basis: 'per_pax' }) }), null, 'no rate → no card, never ₱0');
});

test('per hour asks for the extra-hour price; the other bases do not', () => {
  assert.equal(claimPricingMissing(P({ basis: 'per_hour', minHours: 5, hourBase: 30000 })), 'extra_hour');
  assert.equal(claimPricingMissing(P({ basis: 'per_hour', minHours: 5, hourBase: 30000, extraHour: 6500 })), null);
  assert.equal(claimPricingMissing(P({ basis: 'per_pax', perPax: 1350 })), null);
  assert.equal(claimPricingMissing(undefined), null);
});

test('the post is re-read: pricing and payment answers come through well-shaped, junk does not', () => {
  const raw = JSON.stringify({
    name: 'Rosa’s Kitchen',
    services: [{ category: 'catering', leaf: null, label: 'Catering', fromRecord: true }],
    cards: [
      {
        name: 'Catering',
        category: 'catering',
        price: '162000',
        inclusions: [],
        fromRecord: true,
        pricing: { basis: 'per_pax', perPax: '1,350', minPax: '120', extras: [{ name: 'Dessert bar', price: '9000' }, { name: '' }] },
      },
      { name: 'Booth', category: 'photo_booth', price: 1, pricing: { basis: 'per_week' } },
    ],
    payWays: [
      { keep: true, provider: 'GCash', accountName: 'Rosa Dizon', accountNumber: '0900 000 0000', keepQr: true },
      { keep: false, provider: 'Bank of Nowhere', accountNumber: '1' },
    ],
  });
  const a = parseClaimDoorAnswers(raw)!;
  assert.deepEqual(a.cards[0]!.pricing, {
    basis: 'per_pax',
    perPax: 1350,
    minPax: 120,
    minHours: null,
    hourBase: null,
    extraHour: null,
    extras: [{ name: 'Dessert bar', price: 9000 }],
  });
  assert.equal(a.cards[1]!.pricing, undefined, 'an unknown basis is no pricing');
  assert.deepEqual(a.payWays, [
    { keep: true, provider: 'GCash', accountName: 'Rosa Dizon', accountNumber: '0900 000 0000', keepQr: true },
    { keep: false, provider: null, accountName: '', accountNumber: '1', keepQr: false },
  ]);
});

test('the finish saves payment details through the SHIPPED addPaymentMethod — its moderation gate untouched', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/open-shop/claim-actions.ts'), 'utf8');
  assert.match(src, /import \{ addPaymentMethod \} from '@\/app\/vendor-dashboard\/payment-options\/actions'/);
  assert.match(src, /claimCardServiceFields\(card\)/);
  // The door never writes the payment table itself, and never sets a moderation status.
  assert.doesNotMatch(src, /from\('vendor_payment_methods'\)/);
  assert.doesNotMatch(src, /moderation_status/);
});
