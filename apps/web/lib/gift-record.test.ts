/**
 * "I SENT IT" — the rules a guest's record must pass, and the words either side
 * reads (owner 2026-10-08; design EGIFTS_WISH_LIST_2026-10-08_fable.md § 2;
 * prototype frames 18–20).
 *
 * Run from apps/web:  npx tsx --test lib/gift-record.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GIFT_NAME_NEEDED,
  GIFT_NAME_TOO_LONG,
  cleanGiftAmount,
  cleanGiftMessage,
  giftGiverName,
  giftSendLabel,
  giftSheetLead,
  giftSheetTitle,
  giftTellLabel,
  giftThanksLine,
  giftThanksTitle,
  onlyWayToGive,
  youSentLine,
} from './gift-record';
import * as words from './gift-record';
import { GIFT_GIVER_NAME_MAX, GIFT_MESSAGE_MAX } from './wish-list';

test('the amount is a whole number of pesos above zero — however a phone types it', () => {
  assert.equal(cleanGiftAmount('500'), 500);
  assert.equal(cleanGiftAmount(' 4,500 '), 4500);
  assert.equal(cleanGiftAmount('₱1,000'), 1000);
  assert.equal(cleanGiftAmount(750), 750);
  for (const not of ['', '   ', '0', '-500', '500.50', '5e3', 'five hundred', '₱', null, undefined, {}, [], NaN, 0, -1, 12.5]) {
    assert.equal(cleanGiftAmount(not), undefined, `${JSON.stringify(not)} was taken for an amount`);
  }
});

test('🔒 nothing caps a gift — only the column’s own size does', () => {
  // No rule in this product sets a largest gift, so none is invented here.
  assert.equal(cleanGiftAmount('1000000'), 1_000_000);
  assert.equal(cleanGiftAmount('999999999'), 999_999_999);
  // Ten digits no longer fit the integer column: refused, never clipped.
  assert.equal(cleanGiftAmount('1000000000'), undefined);
});

test('their word is kept whole or refused — never cut', () => {
  assert.equal(cleanGiftMessage('  Congratulations!  '), 'Congratulations!');
  assert.equal(cleanGiftMessage(''), null);
  assert.equal(cleanGiftMessage('   '), null);
  assert.equal(cleanGiftMessage(null), null);
  assert.equal(cleanGiftMessage(undefined), null);
  assert.equal(cleanGiftMessage('x'.repeat(GIFT_MESSAGE_MAX)), 'x'.repeat(GIFT_MESSAGE_MAX));
  assert.equal(cleanGiftMessage('x'.repeat(GIFT_MESSAGE_MAX + 1)), undefined);
  assert.equal(cleanGiftMessage(42), undefined);
});

test('🔒 the invitation’s own name always wins — a guest cannot sign a gift as somebody else', () => {
  assert.deepEqual(giftGiverName('Tita Nene', 'The Mayor'), { name: 'Tita Nene' });
  assert.deepEqual(giftGiverName('  Tita Nene ', ''), { name: 'Tita Nene' });
  // Only an invitation with no name reads what was typed.
  assert.deepEqual(giftGiverName('', '  Kuya Ben '), { name: 'Kuya Ben' });
  assert.deepEqual(giftGiverName(null, 'Kuya Ben'), { name: 'Kuya Ben' });
  assert.deepEqual(giftGiverName('   ', ''), { refused: GIFT_NAME_NEEDED });
  assert.deepEqual(giftGiverName(null, undefined), { refused: GIFT_NAME_NEEDED });
  assert.deepEqual(giftGiverName(null, 42), { refused: GIFT_NAME_NEEDED });
  assert.deepEqual(giftGiverName('', 'x'.repeat(GIFT_GIVER_NAME_MAX + 1)), { refused: GIFT_NAME_TOO_LONG });
  // A very long invitation name still fits the column.
  assert.equal((giftGiverName('y'.repeat(200), '') as { name: string }).name.length, GIFT_GIVER_NAME_MAX);
});

test('the way they used is written only when there is exactly one way it could have been', () => {
  assert.equal(onlyWayToGive(['gcash']), 'gcash');
  assert.equal(onlyWayToGive(['gcash', 'maya']), null);
  assert.equal(onlyWayToGive([]), null);
});

test('the sheet’s words are the drawing’s (frames 18–19)', () => {
  assert.equal(giftSheetTitle('Maria & Jose'), 'Show Maria & Jose');
  assert.equal(giftSheetLead('Maria & Jose'), 'Your screenshot, the amount and your message go to Maria & Jose only.');
  assert.equal(giftSendLabel('Maria & Jose'), 'Send to Maria & Jose');
  assert.equal(giftTellLabel('Maria & Jose'), 'Sent a gift? Show Maria & Jose');
});

test('the thank-you says only what was handed over (frame 20)', () => {
  const base = { hostName: 'Maria & Jose', amountPhp: 500, wishName: 'Air fryer' as string | null };
  assert.equal(giftThanksTitle('Tita Nene'), 'Thank you, Tita Nene.');
  assert.equal(
    giftThanksLine({ ...base, hasShot: true, hasMessage: true, nowGot: false }),
    'Maria & Jose will see your screenshot, ₱500 and your words beside the Air fryer. No other guest sees them.',
  );
  // No screenshot → none is mentioned; no word → none is mentioned.
  assert.equal(
    giftThanksLine({ ...base, hasShot: false, hasMessage: true, nowGot: false }),
    'Maria & Jose will see ₱500 and your words beside the Air fryer. No other guest sees them.',
  );
  assert.equal(
    giftThanksLine({ ...base, hasShot: false, hasMessage: false, nowGot: false }),
    'Maria & Jose will see ₱500 beside the Air fryer. No other guest sees it.',
  );
  // A gift toward no wish names no wish.
  assert.equal(
    giftThanksLine({ ...base, wishName: null, hasShot: true, hasMessage: false, nowGot: false }),
    'Maria & Jose will see your screenshot and ₱500. No other guest sees them.',
  );
  // The record that reaches the price says so.
  assert.equal(
    giftThanksLine({ ...base, hasShot: true, hasMessage: true, nowGot: true }),
    'Maria & Jose will see your screenshot, ₱500 and your words beside the Air fryer. No other guest sees them — and the wish is now marked got.',
  );
});

test('the guest’s own line on a wish they sent toward', () => {
  assert.equal(youSentLine(500, { pricePhp: 4500, sentPhp: 4500 }), 'You sent ₱500 ✓ · ₱4,500 of ₱4,500');
  assert.equal(youSentLine(1200, { pricePhp: 4500, sentPhp: 2700 }), 'You sent ₱1,200 ✓ · ₱2,700 of ₱4,500');
  // A wish with no price has nothing to be "of".
  assert.equal(youSentLine(800, { pricePhp: null, sentPhp: 800 }), 'You sent ₱800 ✓');
});

test('🔒 every sentence says SENT — Setnayan never held or saw the money', () => {
  const said: string[] = [];
  for (const [, v] of Object.entries(words)) {
    if (typeof v === 'string') said.push(v);
  }
  said.push(
    giftSheetTitle('A'),
    giftSheetLead('A'),
    giftSendLabel('A'),
    giftTellLabel('A'),
    giftThanksTitle('A'),
    giftThanksLine({ hostName: 'A', amountPhp: 1, wishName: 'B', hasShot: true, hasMessage: true, nowGot: true }),
    youSentLine(1, { pricePhp: 2, sentPhp: 1 }),
  );
  assert.ok(said.length >= 20, `only ${said.length} sentences were read — the scan stopped seeing the words`);
  const banned = /\b(receiv\w*|verif\w*|confirm\w*|refund\w*|paid|payment\w*|funded|money back|guarantee\w*)\b/i;
  assert.deepEqual(said.filter((line) => banned.test(line)), []);
});
