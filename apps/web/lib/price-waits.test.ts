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

test('every door to the price sheet goes through the rule — none opens it directly', () => {
  // The one place the price sheet may be named in a setSheet call is askSheet.
  const direct = MAKER.match(/setSheet\('price'\)/g) ?? [];
  assert.equal(direct.length, 0, 'a door opens the price sheet without asking whether it waits');
  assert.match(MAKER, /onClick=\{\(\) => askSheet\('price'\)\}/, 'the card’s price region');
  assert.match(MAKER, /onClick=\{\(\) => askSheet\(row\.key\)\}/, 'the "Make it richer" rows');
  assert.match(MAKER, /\n\s*askSheet\(key\);\n\s*\};/, 'the coach chip and the diagnostics rows');
  assert.match(MAKER, /key === 'price' && priceWaits \? \(priceWaits === 'photo' \? 'media' : 'custom'\) : key/);
});

test('a guided first pass from a couple’s link asks for what’s included before the price', () => {
  assert.match(MAKER, /if \(claimToken\) steps\.push\('media', 'custom', 'price', 'excl'\);/);
  assert.match(MAKER, /else steps\.push\('media', 'price', 'custom', 'excl'\);/, 'everyone else keeps the shipped order');
});

test('the price the couple recorded is still shown while the box waits', () => {
  const region = MAKER.slice(MAKER.indexOf('data-price-waits={priceWaits}'));
  assert.match(region.slice(0, 400), /\{snap\.priceLine\}/);
  assert.match(region.slice(0, 600), /\{priceWaitsLine\(priceFacts\)\}/);
});
