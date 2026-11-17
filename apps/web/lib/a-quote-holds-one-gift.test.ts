/**
 * 🎁 ONE GIFT PER SERVICE CARD — owner 17 Nov 2026, verbatim: "should it be 1 gift per card used? so if they have
 * 2 service cards, thos are 2 gifts?" then "Just counted" (specs DECISION_LOG a74f265b, refining 636a249a).
 *
 * A count, never fewer than one. Checked in every place that carries it:
 *   · the cap (`giftCapFor`) and the judge (`judgeQuoteGifts`) — over the cap is `too_many`, before stock or limit;
 *   · the picker (`addGiftMenu` + `quote-shop-gifts.tsx`) — at the cap, nothing else can be added;
 *   · the server write (`writeQuoteShopGifts`) — re-counts the shop's OWN ACTIVE cards, so a crafted list of card ids
 *     cannot raise the cap, and refuses `too_many` before it inserts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { giftCapFor } from './shop-gifts';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('the cap is one gift per card, never fewer than one', () => {
  assert.equal(giftCapFor(0), 1, 'a quote with no card still holds one gift');
  assert.equal(giftCapFor(1), 1);
  assert.equal(giftCapFor(2), 2);
  assert.equal(giftCapFor(3), 3);
  assert.equal(giftCapFor(Number.NaN), 1);
  assert.equal(giftCapFor(-4), 1);
});

test('the judge calls over-the-cap too many, before stock or limit', () => {
  const src = read('lib/shop-gifts.ts');
  const body = src.slice(src.indexOf('export function judgeQuoteGifts'), src.indexOf('export type ShopGiftQuoteBasis'));
  assert.match(body, /maxGifts = 1,\n\): QuoteGiftsVerdict/, 'the judge must default to ONE gift when no cap is passed');
  const tooMany = body.indexOf("codes.length > maxGifts) return { ...base, state: 'too_many' }");
  assert.ok(tooMany > 0, 'judgeQuoteGifts no longer returns too_many over the cap');
  for (const later of ["state: 'over_limit'", "state: 'short'", "state: 'ok'"]) {
    assert.ok(body.indexOf(later) > tooMany, `${later} is judged before the one-gift-per-card rule`);
  }
});

test('the add menu offers nothing at the cap', () => {
  const src = read('lib/shop-gifts.ts');
  const body = src.slice(src.indexOf('export function addGiftMenu'));
  assert.match(body, /codes\.length >= maxGifts\) return \{[^}]*ok: false/);
});

test('the composer counts the picked cards and hides the add button at the cap', () => {
  const comp = read('app/_components/quote-shop-gifts.tsx');
  assert.match(comp, /const maxGifts = giftCapFor\(cardCount\)/);
  assert.match(comp, /codes\.length >= maxGifts \? \([\s\S]{0,400}One gift per service card[\s\S]{0,200}<PickMenu/);
  const maker = read('app/_components/proposal-maker.tsx');
  assert.match(maker, /<QuoteShopGifts[\s\S]{0,300}cardCount=\{cards\.filter\(\(c\) => pickedCards\[c\.id\]\)\.length\}/);
});

test('the server re-counts the shop’s own active cards and refuses over the cap', () => {
  const src = read('lib/shop-gifts.server.ts');
  const body = src.slice(src.indexOf('export async function writeQuoteShopGifts'));
  const count = body.slice(body.indexOf(".from('vendor_services')"), body.indexOf('const maxGifts = giftCapFor(cardCount)'));
  assert.match(count, /\.eq\('vendor_profile_id', args\.vendorProfileId\)/, 'cards must be this shop’s own');
  assert.match(count, /\.eq\('is_active', true\)/, 'only active cards count');
  assert.match(count, /\.in\('vendor_service_id', cardIds\)/);
  const refuse = body.indexOf("v.state === 'too_many') return { ok: false");
  assert.ok(refuse > 0, 'writeQuoteShopGifts no longer refuses too_many');
  assert.ok(refuse < body.indexOf(".from('vendor_proposal_shop_gifts').insert"), 'too_many is checked after the insert');
  const send = read('lib/proposal-send.ts');
  assert.match(send, /writeQuoteShopGifts\([\s\S]{0,300}serviceCardIds: input\.serviceCardIds \?\? null/);
});
