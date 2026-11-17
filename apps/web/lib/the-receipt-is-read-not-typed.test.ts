/**
 * ⚖ OWNER 2026-11-17, verbatim: *"the don't have to type. we detect after they
 * sent it and log the data for the admin to send his counterpart screenshot"*.
 *
 * The payer uploads a receipt and types nothing; the reader takes the
 * reference, the amount, the date and the time off it, and the pay action
 * stores them on the payment for the admin to match. ADVISORY — nothing read
 * here approves money (`an-ai-may-not-approve-money.test.ts` still holds).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPaymentReceipt } from './payment-receipt-read';
import { extractReceiptPaidAt } from './payment-proof-scan';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

// Real-shaped layouts: GCash prints month-first 12-hour, BDO day-first 24-hour.
const GCASH = `Sent via GCash
Nov 17, 2026 3:04 PM
Ref No. 0043 457 367694
Amount PHP 2,499.00`;

const BDO_INSTAPAY = `Transfer successful
17 Nov 2026 15:04:22
Ref No. 9911223344556
InstaPay Invoice No. 6991560
Amount PHP 1,499.00`;

test('the date and time are read off a GCash-shaped receipt (12-hour → 24-hour)', () => {
  assert.deepEqual(extractReceiptPaidAt(GCASH), { date: '2026-11-17', time: '15:04' });
});

test('the date and time are read off a BDO-shaped receipt (day first, seconds kept)', () => {
  assert.deepEqual(extractReceiptPaidAt(BDO_INSTAPAY), { date: '2026-11-17', time: '15:04:22' });
});

test('other printed shapes', () => {
  assert.deepEqual(extractReceiptPaidAt('2026-11-17 09:30'), { date: '2026-11-17', time: '09:30' });
  assert.deepEqual(extractReceiptPaidAt('11/17/2026 12:05 AM'), { date: '2026-11-17', time: '00:05' });
  assert.deepEqual(extractReceiptPaidAt('17/11/2026 12:05 PM'), { date: '2026-11-17', time: '12:05' });
  assert.deepEqual(extractReceiptPaidAt('November 3 2026 at 7:15 p.m.'), { date: '2026-11-03', time: '19:15' });
});

test('no date is NULL, never a guess — and never today', () => {
  assert.deepEqual(extractReceiptPaidAt('Ref No. 0043457367694\nAmount PHP 2.17'), { date: null, time: null });
  // 31 Feb is not a date; 25:00 is not a time; an amount is not a time.
  assert.deepEqual(extractReceiptPaidAt('Feb 31, 2026 25:00 PHP 12.17'), { date: null, time: null });
});

test('the read carries the reference to LOG, the date and the time — BDO’s key leads', () => {
  const r = readPaymentReceipt({ transcript: BDO_INSTAPAY, typed: null, expectedPhp: 1499 });
  assert.equal(r.status, 'ok');
  // On BDO the "Ref No." is the payer's own decoy; the InstaPay invoice is what
  // our BDO record carries (payment-proof-scan.ts header).
  assert.equal(r.readReference, '6991560');
  assert.equal(r.seenPaidOn, '2026-11-17');
  assert.equal(r.seenPaidTime, '15:04:22');
  assert.equal(r.amountMatches, true);
  // Nothing typed ⇒ no verdict about the payer — so nobody is ever sent back.
  assert.equal(r.referenceMatches, null);
});

test('an unreadable picture reads nothing at all', () => {
  const r = readPaymentReceipt({ transcript: 'UNREADABLE', typed: null, expectedPhp: 1 });
  assert.equal(r.readReference, null);
  assert.equal(r.seenPaidOn, null);
  assert.equal(r.seenPaidTime, null);
});

test('the pay form has no typed reference field any more', () => {
  const panel = read('app/pay/[reference]/_components/pay-panel.tsx');
  assert.doesNotMatch(panel, /name="reference_last6"/, 'the "last 6 digits" field is back');
  assert.doesNotMatch(panel, /Last 6 digits/i);
  assert.match(panel, /name="screenshot_ref"/, 'the receipt upload is gone');
});

test('the action REQUIRES the picture and logs what was read on the payment', () => {
  const action = read('app/pay/[reference]/actions.ts');
  assert.match(action, /if \(!screenshotUrl\) \{/, 'a send with no receipt is accepted again');
  // What was read on the payer's phone — or what they corrected it to — is logged.
  assert.match(action, /const logged = loggedFromPhone\(formData, receiptRead\);/);
  assert.match(action, /reference_number: bankReference \?\? logged\.reference \?\? null/);
  assert.match(action, /paid_at: logged\.paidOn \?\?/);
  // …and the read is still filed for the admin, with the date and time.
  assert.match(action, /recordPaymentReceiptRead\(moneyWriter, newPaymentId, \{ \.\.\.receiptRead, model: ON_PHONE_READER_NAME \}\)/);
  const server = read('lib/payment-receipt-read.server.ts');
  assert.match(server, /seen_paid_on: read\.seenPaidOn/);
  assert.match(server, /seen_paid_time: read\.seenPaidTime/);
});

test('reading the receipt never sets a payment status', () => {
  // The read fills lookup keys. Approval stays the admin's.
  const action = read('app/pay/[reference]/actions.ts');
  const insert = action.slice(action.indexOf(".from('payments')\n    .insert("));
  const row = insert.slice(0, insert.indexOf('.select('));
  assert.doesNotMatch(row, /status:/, 'the proof insert now writes a status');
});
