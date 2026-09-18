/**
 * SUP-41 · A SERVICE CARD ON THE MARKETPLACE IS THE SAME CARD AS ON ITS SHOP.
 *
 * `/explore` and `app/v/[slug]` both draw `ServiceCardView` from the one
 * builder, `toServiceCard`. The marketplace called it with the record hard-wired
 * to `null` and `hidePrices` hard-wired to `false`, so:
 *   · a card with a real booking history (the medal case) looked brand new on
 *     the marketplace and veteran one click later, on its shop;
 *   · a shop that chose "hide my prices publicly" had its prices printed on the
 *     marketplace grid while its own page and the vendor grid hid them.
 *
 * 🔑 THE ASSERTION IS ON THE ARGUMENT, NOT ON THE FILE. The names this test
 * looks for already appear elsewhere in the page (the vendor grid reads
 * `hidingPrices` too), so a file-level match would stay green with the card's
 * own argument reverted to `false`. The call is parsed and each positional
 * argument checked where it sits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { cardRecordRatingFromTrusted } from '@/lib/service-card-record';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, '..', ...p), 'utf8'));

/** Every `toServiceCard(` call's top-level arguments, in source order. */
function toServiceCardCalls(src: string): string[][] {
  const calls: string[][] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf('toServiceCard(', from);
    if (at === -1) return calls;
    let i = at + 'toServiceCard('.length;
    let depth = 0;
    let cur = '';
    const args: string[] = [];
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') {
        if (depth === 0) break;
        depth--;
      }
      if (ch === ',' && depth === 0) {
        args.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    calls.push(args);
    from = i;
  }
}

// Positions, from the builder's own signature in lib/service-card-view-model.ts.
const HIDE_PRICES = 5;
const CARD_RECORD = 8;
const CARD_RECORD_RATING = 9;

test('the builder signature still has the record and hidePrices where this test looks', () => {
  const vm = read('lib', 'service-card-view-model.ts');
  const sig = vm.slice(vm.indexOf('export function toServiceCard('));
  const params = sig
    .slice(sig.indexOf('(') + 1, sig.indexOf('): '))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-zA-Z]+\??:/.test(l))
    .map((l) => l.split(':')[0]!.replace('?', ''));
  assert.equal(params[HIDE_PRICES], 'hidePrices', `params were: ${params.join(', ')}`);
  assert.equal(params[CARD_RECORD], 'cardRecord', `params were: ${params.join(', ')}`);
  assert.equal(params[CARD_RECORD_RATING], 'cardRecordRating', `params were: ${params.join(', ')}`);
});

test('the marketplace passes each card its record, its shop rating and the shop price choice', () => {
  const calls = toServiceCardCalls(read('app', '(shell)', 'explore', 'page.tsx'));
  // Floor: exactly one call. Zero means the grid stopped using the builder
  // (the-marketplace-body-lists-services pins that); two means a second grid
  // appeared that this test has not looked at.
  assert.equal(calls.length, 1, `expected 1 toServiceCard( call on /explore, found ${calls.length}`);
  const args = calls[0]!;
  assert.ok(args.length >= 10, `toServiceCard( has ${args.length} arguments`);
  assert.match(
    args[HIDE_PRICES]!,
    /serviceCardHidingPrices\.has\(/,
    `hidePrices is "${args[HIDE_PRICES]}" — a shop that hides its prices has them printed on the marketplace`,
  );
  assert.match(
    args[CARD_RECORD]!,
    /serviceCardRecords\.get\(/,
    `cardRecord is "${args[CARD_RECORD]}" — the card's record never reaches the marketplace`,
  );
  assert.match(
    args[CARD_RECORD_RATING]!,
    /cardRecordRatingFromTrusted\(/,
    `cardRecordRating is "${args[CARD_RECORD_RATING]}" — the shop-rating badge uses a different rule than the shop page`,
  );
});

test('the records are read through the same flag and batched reader as the shop page', () => {
  const explore = read('app', '(shell)', 'explore', 'page.tsx');
  assert.match(explore, /cardRecordEnabled\(\)\s*\?\s*fetchServiceCardRecords\(/);
  const shop = read('app', 'v', '[slug]', 'page.tsx');
  assert.match(shop, /cardRecordRating=\{cardRecordRatingFromTrusted\(/);
});

test('the shop-rating rule: nothing until a trusted review exists', () => {
  assert.equal(cardRecordRatingFromTrusted(undefined), null);
  assert.equal(cardRecordRatingFromTrusted({ trusted_avg_rating: 0, trusted_review_count: 0 }), null);
  assert.equal(cardRecordRatingFromTrusted({ trusted_avg_rating: 4.5, trusted_review_count: 0 }), null);
  assert.equal(cardRecordRatingFromTrusted({ trusted_avg_rating: null, trusted_review_count: 3 }), null);
  assert.deepEqual(
    cardRecordRatingFromTrusted({ trusted_avg_rating: 4.8, trusted_review_count: 3 }),
    { avg: 4.8, count: 3 },
  );
});
