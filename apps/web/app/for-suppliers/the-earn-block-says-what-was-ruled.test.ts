/**
 * the-earn-block-says-what-was-ruled.test.ts — "How Setnayan earns" (For Suppliers beat 11, `#earn`) holds the owner's
 * 16 Nov 2026 rulings (DECISION_LOG e5d166cd, "1a 2a 3a") and says only what ships.
 *
 *   · (1) the paid-spot promise is the ruled sentence, word for word;
 *   · the Free row reads "All your own clients, no limit";
 *   · (3) the badge reward ("a free booking fee from 1,000 events") stays in the Badges ⓘ only — never in this block;
 *   · every ₱ is a prop read from the catalogue or the live fee schedule — none is typed; the gift row shows Papic 150's
 *     LIST price and "Buy 10, get 1 free." (14 Nov / 16 Nov 03e465e1), never the withheld gift column;
 *   · Deep Search is sold to Plus, Pro and Ultra only, so the block never says "every plan";
 *   · the block is mounted inside `#model`, and the hero's "How the fee works" ⓘ links to it;
 *   · it adds no server action and no form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { EARN_FREE_ROWS, EARN_PROMISES, GIFT_BUNDLE_WORDS, PAID_SPOT_PROMISE } from './_components/supplier-how-we-earn-data';

const DIR = join(__dirname, '_components');
const block = stripComments(readFileSync(join(DIR, 'supplier-how-we-earn.tsx'), 'utf8'));
const words = stripComments(readFileSync(join(DIR, 'supplier-how-we-earn-data.ts'), 'utf8'));
const page = stripComments(readFileSync(join(DIR, 'supplier-front-page.tsx'), 'utf8'));

test('(1) the paid-spot promise is the ruled sentence, and it is one of the promises shown', () => {
  assert.equal(
    `${PAID_SPOT_PROMISE.title} ${PAID_SPOT_PROMISE.body}`,
    'No one can pay to rank above you. If that ever changes, every paid spot will say Paid.',
  );
  assert.ok(EARN_PROMISES.includes(PAID_SPOT_PROMISE), 'the paid-spot promise is not in the list the block renders');
  assert.match(block, /EARN_PROMISES\.map\(/, 'the block does not render its promises');
  assert.doesNotMatch(block + words, /no paid spots today/i, 'the drawing’s superseded wording came back');
});

test('the Free row says all your own clients, no limit', () => {
  const own = EARN_FREE_ROWS.find((r) => r.title === 'Your own clients');
  assert.ok(own, 'the "Your own clients" row is gone');
  assert.ok(own.body.startsWith('All your own clients, no limit'), own.body);
  assert.match(block, /EARN_FREE_ROWS\.map\(/, 'the block does not render its Free rows');
});

test('(3) the badge reward is not repeated in this block', () => {
  assert.doesNotMatch(block + words, /1,000 events|free booking fee from/i, 'the badge reward is repeated outside the Badges ⓘ');
  assert.match(page, /a free booking fee from 1,000 events/, 'anti-vacuity: the Badges ⓘ no longer carries the reward');
});

test('every peso is read, never typed — the gift row shows the list price and the bundle, never the gift column', () => {
  assert.deepEqual((block + words).match(/₱\s?\d/g) ?? [], [], 'a peso figure is typed into the block');
  assert.doesNotMatch(block, /\b\d+(\.\d+)?%/, 'a fee rate is typed into the block');
  assert.match(block, /figures\.head[\s\S]{0,80}figures\.band[\s\S]{0,80}figures\.tail/, 'the fee is not placed from the live figures');
  const mount = page.match(/<SupplierHowWeEarn[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(mount, /figures=\{words\.figures\}/, 'the block is not handed the live fee figures');
  assert.match(mount, /plus:\s*prices\.soloMonthly,\s*pro:\s*prices\.proMonthly,\s*ultra:\s*prices\.enterpriseMonthly/, 'plan prices are not the catalogue’s');
  assert.match(mount, /deepSearch=\{prices\.bySku\[VENDOR_DEEP_SEARCH_SKU_CODE\]/, 'Deep Search is not priced from its catalogue row');
  const gift = block.slice(block.indexOf('<b>Gifts for your couples</b>'));
  assert.ok(block.includes('<b>Gifts for your couples</b>'), 'anti-vacuity: the gift row is gone');
  const giftRow = gift.slice(0, gift.indexOf('</div>'));
  assert.match(giftRow, /From \{dash\(giftFrom\)\} \(Papic 150\)\. \{GIFT_BUNDLE_WORDS\}/, 'the gift row lost its list price or the bundle');
  assert.equal(GIFT_BUNDLE_WORDS, 'Buy 10, get 1 free.');
  assert.match(mount, /giftFrom=\{giftFrom\}/, 'the block is not handed the gift price');
  const route = stripComments(readFileSync(join(__dirname, '..', '(shell)', 'for-suppliers', 'page.tsx'), 'utf8'));
  assert.match(route, /const GIFT_FROM_SKU = 'PAPIC_GUEST_150';/, 'the gift row prices from a different gift');
  assert.match(route, /getCustomerSkuPrice\(GIFT_FROM_SKU\)/, 'the gift price is not the catalogue list price');
  assert.match(route, /giftFrom=\{papic150 \? `₱\$\{papic150\}` : null\}/, 'the list price is not handed to the page');
  for (const src of [block, words, route, page]) assert.doesNotMatch(src, /gift_price|giftPrice|gift price/i, 'the withheld gift column is read or named');
});

test('Deep Search names the plans that can buy it', () => {
  assert.doesNotMatch(block + words, /every plan/i, 'Deep Search is refused on Free and Verified — "every plan" is untrue');
  assert.match(block, /on Plus, Pro and Ultra/);
});

test('the block is mounted inside #model and the hero ⓘ links to it', () => {
  const model = page.slice(page.indexOf('id="model"'), page.indexOf('id="plans"'));
  assert.ok(page.indexOf('id="model"') > 0 && model.length > 0, 'anti-vacuity: #model or #plans moved');
  assert.match(model, /<SupplierHowWeEarn\b/, 'the block is not mounted in beat 11');
  assert.match(block, /id="earn"/, 'the block has no #earn anchor');
  const hero = page.match(/<Info label="How the fee works">[\s\S]*?<\/Info>/)?.[0] ?? '';
  assert.match(hero, /href="#earn"[\s\S]{0,40}How Setnayan earns/, 'the hero ⓘ does not link to the block');
});

test('it adds no server action and no form', () => {
  assert.doesNotMatch(block, /['"]use server['"]|<form\b|action=/, 'the block posts something');
});
