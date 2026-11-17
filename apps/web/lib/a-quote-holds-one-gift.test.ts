/**
 * 🎁 A QUOTE HOLDS ONE GIFT — owner 17 Nov 2026, verbatim: "only 1 will be held for any quote."
 * (specs DECISION_LOG, "Gifts: a quote holds at most ONE gift ticket").
 *
 * Three places carry it, and each is checked here:
 *   · the judge (`judgeQuoteGifts`) — two gifts are `too_many`, whatever the stock or the limit;
 *   · the picker (`addGiftMenu` + `quote-shop-gifts.tsx`) — with one on, nothing else can be added;
 *   · the server write (`writeQuoteShopGifts`) — refuses `too_many`, so a crafted payload cannot hold two.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAX_GIFTS_PER_QUOTE } from './shop-gifts';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('the rule is one', () => {
  assert.equal(MAX_GIFTS_PER_QUOTE, 1);
});

test('the judge calls two gifts too many, before stock or limit', () => {
  const src = read('lib/shop-gifts.ts');
  const body = src.slice(src.indexOf('export function judgeQuoteGifts'), src.indexOf('export type ShopGiftQuoteBasis'));
  const tooMany = body.indexOf("codes.length > MAX_GIFTS_PER_QUOTE) return { ...base, state: 'too_many' }");
  assert.ok(tooMany > 0, 'judgeQuoteGifts no longer returns too_many for more than one gift');
  for (const later of ["state: 'over_limit'", "state: 'short'", "state: 'ok'"]) {
    assert.ok(body.indexOf(later) > tooMany, `${later} is judged before the one-gift rule`);
  }
});

test('the add menu offers nothing once a gift is on', () => {
  const src = read('lib/shop-gifts.ts');
  const body = src.slice(src.indexOf('export function addGiftMenu'));
  assert.match(body, /codes\.length >= MAX_GIFTS_PER_QUOTE\) return \{[^}]*ok: false/);
});

test('the composer hides the add button once a gift is on', () => {
  const src = read('app/_components/quote-shop-gifts.tsx');
  assert.match(src, /codes\.length >= MAX_GIFTS_PER_QUOTE \? \([\s\S]{0,400}One gift per quote[\s\S]{0,200}<PickMenu/);
});

test('the server refuses two gifts', () => {
  const src = read('lib/shop-gifts.server.ts');
  const body = src.slice(src.indexOf('export async function writeQuoteShopGifts'));
  const refuse = body.indexOf("v.state === 'too_many') return { ok: false");
  assert.ok(refuse > 0, 'writeQuoteShopGifts no longer refuses too_many');
  assert.ok(refuse < body.indexOf(".from('vendor_proposal_shop_gifts').insert"), 'too_many is checked after the insert');
});
