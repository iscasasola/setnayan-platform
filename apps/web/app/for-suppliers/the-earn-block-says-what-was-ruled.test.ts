/**
 * the-earn-block-says-what-was-ruled.test.ts — "How Setnayan earns" (For Suppliers beat 11, `#earn`) holds the owner's
 * 16 Nov 2026 rulings (DECISION_LOG e5d166cd, "1a 2a 3a") and says only what ships.
 *
 *   · (1) the paid-spot promise is the ruled sentence, word for word;
 *   · own clients are said only in the 19 Nov words, SUPPLIER_FREE_BOOKING_LINE (DECISION_LOG 2026-11-19 "PROMOTION
 *     PAGES", item 4): the retired "All your own clients, no limit… free for a year" line is gone, and no months are named;
 *   · (3) the badge reward ("a free booking fee from 1,000 events") is never in this block — and, since no badge earns a
 *     new free fee (15 Nov ladder, `FIRST_FREE_FEE_STEP` = 0), nowhere on the page;
 *   · every ₱ is a prop read from the catalogue or the live fee schedule — none is typed; the gift row shows Papic 150's
 *     LIST price and "Buy 10, get 1 free." (14 Nov / 16 Nov 03e465e1), never the withheld gift column;
 *   · Deep Search is sold to Plus, Pro and Ultra only, so the block never says "every plan";
 *   · the block is mounted inside `#model` (the fees section), and the hero's "How the fee works" ⓘ links to it;
 *   · it adds no server action and no form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  EARN_FREE_ROWS,
  EARN_HEADLINE,
  EARN_LEDE,
  EARN_PROMISES,
  EARN_RULED_LINE,
  GIFT_BUNDLE_WORDS,
  GROW_PROMISE,
  PAID_SPOT_PROMISE,
  SUPPLIER_FREE_BOOKING_LINE,
} from './_components/supplier-how-we-earn-data';
import { FIRST_FREE_FEE_STEP } from '@/lib/badge-rewards';

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

test('the Free row says own clients book free in the 19 Nov words', () => {
  assert.equal(SUPPLIER_FREE_BOOKING_LINE, "New to Setnayan, or you're the first to bring their event? They book you free.");
  const own = EARN_FREE_ROWS.find((r) => r.title === 'Your own clients');
  assert.ok(own, 'the "Your own clients" row is gone');
  assert.ok(own.body.includes(SUPPLIER_FREE_BOOKING_LINE), own.body);
  assert.match(block, /EARN_FREE_ROWS\.map\(/, 'the block does not render its Free rows');
});

test('own clients follow the 19 Nov ruling — the retired line is gone, no months are named, never "free for life"', () => {
  assert.doesNotMatch(block + words, /free for life/i, 'the retired "free for life" rule came back');
  assert.match(words, /title: OWN_CLIENT_PROMISE,/, 'the own-client promise is not main\u2019s shipped line');
  const own = EARN_PROMISES.find((p) => p.title !== PAID_SPOT_PROMISE.title && p.body.includes(SUPPLIER_FREE_BOOKING_LINE));
  assert.ok(own, 'anti-vacuity: the own-client promise no longer says the 19 Nov line');
  // The retired 16 Nov line, in any of the shapes it shipped in — on the block, its words and the page around it.
  for (const src of [block, words, page]) {
    assert.doesNotMatch(src, /All your own clients, no limit/i, 'the retired own-clients line came back');
    assert.doesNotMatch(src, /free for a year|for 12 months|\bFEE_FREE_RULE\b/i, 'a number of months is named again');
  }
});

test('(3) the badge reward is not repeated in this block — nor anywhere, while no badge earns a new free fee', () => {
  assert.doesNotMatch(block + words, /1,000 events|free booking fee from/i, 'the badge reward is repeated outside the Badges ⓘ');
  // The 15 Nov ladder pays Event Plus at 1,000 events; no step earns a new free fee. The page may not promise one.
  assert.equal(FIRST_FREE_FEE_STEP, 0, 'a badge step earns a free fee again — say it in the fees section, then update this');
  assert.doesNotMatch(page, /free booking fee from|badge steps? gives? you a ticket/i, 'the page promises a fee ticket no badge pays');
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

test('owner 23 Nov: the block leads with growth and what we give; the 16 Nov ruled line still closes the lede', () => {
  assert.match(EARN_HEADLINE, /grow your business/i);
  assert.equal(EARN_RULED_LINE, 'We charge for what we add. Never for what you already had.');
  assert.ok(EARN_LEDE.endsWith(EARN_RULED_LINE), 'the ruled line left the lede');
  assert.equal(EARN_PROMISES[0], GROW_PROMISE, 'what we give is no longer the first promise');
  assert.match(block, /\{EARN_HEADLINE\}/);
  assert.match(block, /\{EARN_LEDE\}/);
});

test('owner 23 Nov: disputing a fee is not something the public page shares — no promise, no ⓘ', () => {
  for (const src of [block, words, page]) assert.doesNotMatch(src, /Dispute this fee|question any fee|fee is questioned/i);
});
