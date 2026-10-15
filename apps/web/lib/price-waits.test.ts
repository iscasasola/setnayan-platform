/**
 * On the card a couple's record seeds, the price box waits for the photo and
 * what's included (owner 2026-10-07; ruled 2026-10-10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { priceWaitsFor, priceWaitsLine } from './price-waits';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAKER = stripComments(
  readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'),
);

test('it waits for the photo first, then what’s included, then opens', () => {
  const link = { fromCoupleLink: true };
  assert.equal(priceWaitsFor({ ...link, hasCover: false, hasInclusions: false }), 'photo');
  assert.equal(priceWaitsFor({ ...link, hasCover: false, hasInclusions: true }), 'photo');
  assert.equal(priceWaitsFor({ ...link, hasCover: true, hasInclusions: false }), 'included');
  assert.equal(priceWaitsFor({ ...link, hasCover: true, hasInclusions: true }), null);
});

test('only the card from a couple’s link waits — every other card is as shipped', () => {
  for (const hasCover of [true, false]) {
    for (const hasInclusions of [true, false]) {
      assert.equal(priceWaitsFor({ fromCoupleLink: false, hasCover, hasInclusions }), null);
    }
  }
});

test('the box says what it is waiting for', () => {
  assert.equal(
    priceWaitsLine({ hasCover: false, hasInclusions: false }),
    'Your price waits — finish the cover and what’s included first.',
  );
  assert.equal(priceWaitsLine({ hasCover: false, hasInclusions: true }), 'Your price waits — add your cover photo first.');
  assert.equal(priceWaitsLine({ hasCover: true, hasInclusions: false }), 'Your price waits — add what’s included first.');
});

test('the maker asks the rule with the claim token and the publish gate’s own facts', () => {
  assert.match(
    MAKER,
    /const priceFacts = \{ hasCover: snap\.hasCover, hasInclusions: inclusionsAreSet\(snap\.inclusionLabels\) \};/,
  );
  assert.match(MAKER, /priceWaitsFor\(\{ fromCoupleLink: Boolean\(claimToken\), \.\.\.priceFacts \}\)/);
});

test('while the price waits, its box is out of reach but still MOUNTED — the recorded price still posts', () => {
  // The simpler maker (2026-10-14) keeps every field in an in-page fold; the price waits by hiding its box, never
  // by unmounting it (an unmounted input would post no price at all and the couple's figure would be lost).
  assert.match(MAKER, /<div hidden=\{Boolean\(priceWaits\)\}>\s*<PricingBasisEditor/, 'the waiting box is no longer hidden-but-mounted');
  assert.ok(!/priceWaits \? null : \(\s*<PricingBasisEditor/.test(MAKER), 'the waiting box was unmounted');
});

test('the Price row says what it waits for', () => {
  assert.match(MAKER, /line=\{priceWaits \? priceWaitsLine\(priceFacts\) : 'Shown as “from”'\}/);
});

test('the price the couple recorded is still shown while the box waits', () => {
  const at = MAKER.indexOf('data="price"');
  const head = MAKER.slice(at, at + 900);
  assert.match(head, /aside=\{snap\.hasPrice \? <span[^>]*>\{snap\.priceLine/, 'the recorded price stopped showing on the row');
});
