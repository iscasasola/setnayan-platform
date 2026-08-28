import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readPaymentReceipt,
  shouldAskBuyerToFix,
  receiptReadTone,
  summariseReceiptRead,
  RECEIPT_TRANSCRIBE_PROMPT,
  NOT_A_RECEIPT,
  UNREADABLE,
} from './payment-receipt-read';

/**
 * The receipts below are the real layouts from lib/payment-proof-scan.test.ts —
 * a GCash-to-GCash transfer and a bank-to-BDO InstaPay one — because those are
 * what the parser was written against. Inventing a tidier fixture here would
 * test this file against a receipt no bank prints.
 */
const GCASH = `Sent via GCash
Ref No. 0043 457 367694
Amount PHP 2,499.00
Total Amount Sent PHP 2,499.00`;

const BDO_INSTAPAY = `Transfer successful
Ref No. 9911223344556
InstaPay Invoice No. 6991560
Amount PHP 1,499.00`;

// ── The question the owner actually asked ───────────────────────────────────

test('the digits they typed ARE on the picture', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 2499 });
  assert.equal(r.status, 'ok');
  assert.equal(r.referenceMatches, true);
  assert.equal(r.amountMatches, true);
  assert.equal(receiptReadTone(r), 'agrees');
});

test('the digits they typed are NOT on the picture', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: '111111', expectedPhp: 2499 });
  assert.equal(r.referenceMatches, false);
  assert.equal(receiptReadTone(r), 'disagrees');
});

test('a grouped reference matches the ungrouped digits they typed', () => {
  // GCash prints "0043 457 367694"; nobody types the spaces.
  const r = readPaymentReceipt({ transcript: GCASH, typed: '0043457367694', expectedPhp: null });
  assert.equal(r.referenceMatches, true);
});

test('the BDO decoy does not defeat the match — the invoice number counts too', () => {
  const r = readPaymentReceipt({ transcript: BDO_INSTAPAY, typed: '6991560', expectedPhp: 1499 });
  assert.equal(r.referenceMatches, true);
});

// ── NULL IS A REAL ANSWER. Each of these must NOT come back FALSE, because a
//    FALSE renders on screen as an accusation about a person. ────────────────

test('nothing typed is UNKNOWN, never a mismatch', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: null, expectedPhp: 2499 });
  assert.equal(r.referenceMatches, null);
  assert.equal(receiptReadTone(r), 'unknown');
  assert.match(r.summary, /typed no reference/i);
});

test('too few characters to compare is UNKNOWN, never a mismatch', () => {
  // The pay form's own field accepts four characters, and compareReferences
  // refuses to judge anything shorter than six. Reading that refusal as "no
  // match" would print an accusation the rule had declined to make.
  const r = readPaymentReceipt({ transcript: GCASH, typed: '7694', expectedPhp: 2499 });
  assert.equal(r.referenceMatches, null);
  assert.notEqual(r.referenceMatches, false);
  assert.equal(receiptReadTone(r), 'unknown');
});

test('a receipt with no readable reference is UNKNOWN, never a mismatch', () => {
  const r = readPaymentReceipt({
    transcript: 'Payment successful\nAmount PHP 2,499.00',
    typed: '367694',
    expectedPhp: 2499,
  });
  assert.equal(r.referenceMatches, null);
  assert.notEqual(r.referenceMatches, false);
});

test('no amount readable leaves the amount UNKNOWN, never a mismatch', () => {
  const r = readPaymentReceipt({
    transcript: 'Ref No. 0043 457 367694',
    typed: '367694',
    expectedPhp: 2499,
  });
  assert.equal(r.amountMatches, null);
  assert.notEqual(r.amountMatches, false);
});

// ── The case worth catching: right code, wrong money ────────────────────────

test('a screenshot of a smaller transfer is caught even when the code matches', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 9999 });
  assert.equal(r.referenceMatches, true);
  assert.equal(r.amountMatches, false);
  // One disagreement is enough — the tone must NOT read as agreement just
  // because the reference half passed.
  assert.equal(receiptReadTone(r), 'disagrees');
});

// ── The sentinels ───────────────────────────────────────────────────────────

test('a picture that is not a receipt says so and judges nothing', () => {
  const r = readPaymentReceipt({ transcript: NOT_A_RECEIPT, typed: '367694', expectedPhp: 2499 });
  assert.equal(r.status, 'unreadable');
  assert.equal(r.referenceMatches, null);
  assert.equal(r.amountMatches, null);
});

test('an unreadable picture judges nothing', () => {
  for (const t of [UNREADABLE, '', '   ']) {
    const r = readPaymentReceipt({ transcript: t, typed: '367694', expectedPhp: 2499 });
    assert.equal(r.status, 'unreadable');
    assert.equal(r.referenceMatches, null);
  }
});

// ── The sentence may never overstate ────────────────────────────────────────

test('EVERY summary carries the caveat that a screenshot is not proof', () => {
  const cases = [
    readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 2499 }),
    readPaymentReceipt({ transcript: GCASH, typed: '111111', expectedPhp: 2499 }),
    readPaymentReceipt({ transcript: GCASH, typed: null, expectedPhp: null }),
    readPaymentReceipt({ transcript: 'Ref No. 0043 457 367694', typed: '7694', expectedPhp: null }),
  ];
  for (const c of cases) {
    assert.match(
      c.summary,
      /screenshot is not proof/i,
      `a summary lost the caveat: ${c.summary}`,
    );
  }
});

test('no summary ever claims the payment is confirmed, verified or received', () => {
  const banned = /\b(confirmed|verified|received|approved|paid in full|proof of payment)\b/i;
  const cases = [
    readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 2499 }),
    readPaymentReceipt({ transcript: BDO_INSTAPAY, typed: '6991560', expectedPhp: 1499 }),
    readPaymentReceipt({ transcript: NOT_A_RECEIPT, typed: '1', expectedPhp: 1 }),
  ];
  for (const c of cases) {
    assert.equal(banned.test(c.summary), false, `overstated: ${c.summary}`);
  }
});

test('summariseReceiptRead names the figures rather than asserting a verdict', () => {
  const s = summariseReceiptRead({
    referenceMatches: false,
    referenceReason: 'compared',
    amountMatches: false,
    typed: '111111',
    seenReferences: ['0043457367694'],
    seenAmounts: [50],
    expectedPhp: 2499,
  });
  assert.match(s, /0043457367694/);
  assert.match(s, /₱50\.00/);
  assert.match(s, /₱2,499\.00/);
});

// ── The prompt is the other half of the design ──────────────────────────────

test('the prompt asks for transcription and forbids a verdict', () => {
  // If this ever loosens into "tell me whether it matches", the decision moves
  // from the tested parser back into the model, which is the one thing the
  // whole design exists to prevent.
  assert.match(RECEIPT_TRANSCRIBE_PROMPT, /Transcribe this image/);
  assert.match(RECEIPT_TRANSCRIBE_PROMPT, /Do not say whether anything matches/i);
  assert.match(RECEIPT_TRANSCRIBE_PROMPT, /EXACTLY, including spaces and dashes/);
  assert.match(RECEIPT_TRANSCRIBE_PROMPT, new RegExp(NOT_A_RECEIPT));
  assert.match(RECEIPT_TRANSCRIBE_PROMPT, new RegExp(UNREADABLE));
});

// ── WHO GETS SENT BACK ───────────────────────────────────────────────────────
// The rule that can trap somebody who has already sent money. Every case where
// we are NOT SURE must let them through; only a definite no asks.

test('a definite mismatch asks the buyer to check it', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: '111111', expectedPhp: 2499 });
  assert.equal(shouldAskBuyerToFix(r), true);
});

test('a match does not ask', () => {
  const r = readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 2499 });
  assert.equal(shouldAskBuyerToFix(r), false);
});

test('NOT KNOWING never sends a payer back', () => {
  const cases: Array<[string, ReturnType<typeof readPaymentReceipt>]> = [
    ['unreadable picture', readPaymentReceipt({ transcript: UNREADABLE, typed: '367694', expectedPhp: 2499 })],
    ['not a receipt', readPaymentReceipt({ transcript: NOT_A_RECEIPT, typed: '367694', expectedPhp: 2499 })],
    ['nothing typed', readPaymentReceipt({ transcript: GCASH, typed: null, expectedPhp: 2499 })],
    ['typed too short to compare', readPaymentReceipt({ transcript: GCASH, typed: '7694', expectedPhp: 2499 })],
    ['no reference on the receipt', readPaymentReceipt({ transcript: 'Payment successful\nPHP 2,499.00', typed: '367694', expectedPhp: 2499 })],
  ];
  for (const [why, r] of cases) {
    assert.equal(shouldAskBuyerToFix(r), false, `a payer would be sent back on: ${why}`);
  }
});

test('a reader that never ran never sends a payer back', () => {
  // No key, timed out, image would not decode, no picture at all.
  assert.equal(shouldAskBuyerToFix(null), false);
  assert.equal(shouldAskBuyerToFix(undefined), false);
  assert.equal(
    shouldAskBuyerToFix({ status: 'failed', referenceMatches: null }),
    false,
    'a failure of OUR reader must never cost somebody a payment they already sent',
  );
});

test('a wrong AMOUNT does not send them back — retyping cannot fix it', () => {
  // Right code, smaller transfer. Worth an admin's attention, not a buyer's
  // second attempt: a part payment is a real thing and retyping changes nothing.
  const r = readPaymentReceipt({ transcript: GCASH, typed: '367694', expectedPhp: 9999 });
  assert.equal(r.amountMatches, false);
  assert.equal(receiptReadTone(r), 'disagrees');
  assert.equal(shouldAskBuyerToFix(r), false);
});
