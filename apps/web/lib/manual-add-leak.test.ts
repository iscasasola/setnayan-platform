import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nameMatchesShop, normShopName, pickLeakMatch, type QuotedShop } from './manual-add-leak';

const LOLA: QuotedShop = { vendorProfileId: 'p-lola', name: 'Kusina ni Lola', quotePhp: 198_000 };
const BITUIN: QuotedShop = { vendorProfileId: 'p-bituin', name: 'Bituin Catering', quotePhp: null };
const HIRAYA: QuotedShop = { vendorProfileId: 'p-hiraya', name: 'Hiraya Table', quotePhp: 150_000 };

test('a name matches when either contains the other, ignoring case, accents and marks', () => {
  assert.equal(nameMatchesShop('kusina ni lola', 'Kusina ni Lola'), true);
  assert.equal(nameMatchesShop('Lola', 'Kusina ni Lola'), true);
  assert.equal(nameMatchesShop('Kusina ni Lola Catering Services', 'Kusina ni Lola'), true);
  assert.equal(nameMatchesShop('Kusiná ni Lolá!', 'Kusina ni Lola'), true);
  assert.equal(nameMatchesShop("Tita Baby's Catering", 'Kusina ni Lola'), false);
  assert.equal(nameMatchesShop('Lo', 'Kusina ni Lola'), false, 'two letters is not a name');
  assert.equal(normShopName("  Tita  Baby's "), 'tita baby s');
});

test('the name half: a quoted shop of the same name is the match', () => {
  assert.equal(
    pickLeakMatch({ typedName: 'Lola', typedPricePhp: null, nameDismissed: false, shops: [LOLA, HIRAYA], tolerance: 0.1 }),
    'p-lola',
  );
});

test('"Not them?" turns the name half off — the dismissed match does not count (owner 2026-10-12)', () => {
  assert.equal(
    pickLeakMatch({ typedName: 'Lola', typedPricePhp: null, nameDismissed: true, shops: [LOLA], tolerance: 0.1 }),
    null,
  );
});

test("…but a price within the owner's 10 % still matches after a dismissed name", () => {
  assert.equal(
    pickLeakMatch({ typedName: 'Lola', typedPricePhp: 197_000, nameDismissed: true, shops: [LOLA], tolerance: 0.1 }),
    'p-lola',
  );
});

test('only a shop that QUOTED can match; a saved shop with no quote never does', () => {
  assert.equal(
    pickLeakMatch({ typedName: 'Bituin', typedPricePhp: null, nameDismissed: false, shops: [BITUIN], tolerance: 0.1 }),
    null,
  );
});

test('the price half picks the CLOSEST quote inside the tolerance, and nothing outside it', () => {
  const shops = [LOLA, HIRAYA];
  assert.equal(pickLeakMatch({ typedName: 'Someone', typedPricePhp: 160_000, nameDismissed: false, shops, tolerance: 0.1 }), 'p-hiraya');
  assert.equal(pickLeakMatch({ typedName: 'Someone', typedPricePhp: 185_000, nameDismissed: false, shops, tolerance: 0.1 }), 'p-lola');
  assert.equal(pickLeakMatch({ typedName: 'Someone', typedPricePhp: 120_000, nameDismissed: false, shops, tolerance: 0.1 }), null);
  assert.equal(pickLeakMatch({ typedName: 'Someone', typedPricePhp: null, nameDismissed: false, shops, tolerance: 0.1 }), null);
});
