/**
 * 🧾 YOUR GIFTS › TRANSACTION HISTORY — the words (prototype v16, 2026-11-17).
 *
 *   1 · a sent payment reads "Waiting for approval"; an approved one "In your gifts"; nothing sent "Not paid yet";
 *       a reversal "Refunded"; a cancelled or lapsed order that never landed is not listed at all;
 *   2 · a bought row is worded from its lines; a given row counts Papic packs and unlock units.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GIFT_ORDER_PILL,
  boughtItemWords,
  boughtTitle,
  giftOrderState,
  givenCount,
  givenTotal,
  type GiftHistoryRow,
} from '@/lib/shop-gift-history';

test('1 · where a bought order stands', () => {
  const base = { landed: false, reversed: false, orderStatus: 'submitted', proofSent: false };
  assert.equal(giftOrderState({ ...base, proofSent: true }), 'sent');
  assert.equal(GIFT_ORDER_PILL.sent, 'Waiting for approval');
  assert.equal(giftOrderState(base), 'unpaid');
  assert.equal(giftOrderState({ ...base, landed: true, orderStatus: 'approved' }), 'in_stock');
  assert.equal(GIFT_ORDER_PILL.in_stock, 'In your gifts');
  assert.equal(giftOrderState({ ...base, landed: true, reversed: true }), 'refunded');
  assert.equal(giftOrderState({ ...base, orderStatus: 'refunded' }), 'refunded');
  assert.equal(giftOrderState({ ...base, orderStatus: 'cancelled' }), null);
  assert.equal(giftOrderState({ ...base, orderStatus: 'lapsed', proofSent: true }), null);
  // A landed order is in stock even if its status later reads cancelled (it was a purchase).
  assert.equal(giftOrderState({ ...base, landed: true, orderStatus: 'cancelled' }), 'in_stock');
});

test('2 · bought and given rows are worded from what happened', () => {
  assert.equal(boughtItemWords({ title: 'Papic 150', qty: 2, bundle: false }), 'Papic 150 ×2');
  assert.equal(boughtItemWords({ title: 'Papic 1000', qty: 1, bundle: true }), 'Papic 1000 10 + 1');
  assert.equal(boughtTitle([{ title: 'Event Plus', bundle: false }]), 'You bought · Event Plus');
  assert.equal(
    boughtTitle([
      { title: 'Event Plus', bundle: false },
      { title: 'Papic 150', bundle: true },
      { title: 'Event Pro', bundle: false },
    ]),
    'You bought · 3 items',
  );
  assert.equal(givenCount({ gift_kind: 'papic', packs: -1, delta: -150 }), 1);
  assert.equal(givenCount({ gift_kind: 'event_plus', packs: null, delta: -1 }), 1);
  const rows: GiftHistoryRow[] = [
    { kind: 'given', key: 'a', createdAt: '2026-11-16T12:00:00Z', giftTitle: 'Papic 150', count: 2, eventName: null },
    { kind: 'given', key: 'b', createdAt: '2026-11-16T12:00:00Z', giftTitle: 'Event Plus', count: 1, eventName: 'Ana & Ben' },
    {
      kind: 'bought',
      key: 'c',
      orderId: 'o',
      referenceCode: 'R',
      createdAt: '2026-11-16T12:00:00Z',
      title: 'You bought · Event Plus',
      items: 'Event Plus',
      paidPhp: 1,
      tickets: 1,
      state: 'sent',
    },
  ];
  assert.equal(givenTotal(rows), 3);
});
