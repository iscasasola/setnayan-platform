/**
 * 🧾 THE SUPPLIER-PAYMENT RECEIPT DOCUMENT (`/receipts/payment/[paymentId]`) — the slip's words, which payment it is,
 * and who may open it. Run from apps/web: npx tsx --test lib/payment-receipt-slip.test.ts
 *
 * Sabotage, run 21 Nov: dropping the `payment_refused_at` filter in `receiptOfPayment` turns test 1 red; dropping the
 * host check from the page turns test 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { receiptOfPayment, type PaymentRow } from './deal-end';
import { paymentReceiptLegal, paymentReceiptSlip } from './payment-receipt-slip';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const row = (over: Partial<PaymentRow>): PaymentRow => ({
  payment_id: 'p1',
  amount_php: 9000,
  paid_at: '2026-11-18',
  method: 'GCash',
  reference: 'GC123',
  is_deposit_record: true,
  vendor_confirmed_at: '2026-11-19T02:00:00Z',
  payment_refused_at: null,
  ...over,
});

test('1 · only a confirmed, unrefused payment has a receipt; what is left stands as it was when it was confirmed', () => {
  const pays = [
    row({}),
    row({ payment_id: 'p2', amount_php: 6000, is_deposit_record: false, vendor_confirmed_at: '2026-11-25T02:00:00Z' }),
    row({ payment_id: 'p3', vendor_confirmed_at: null }),
    row({ payment_id: 'p4', payment_refused_at: '2026-11-20T00:00:00Z' }),
  ];
  assert.equal(receiptOfPayment({ payments: pays, paymentId: 'p3', agreedCentavos: 3_000_000 }), null, 'an unconfirmed payment printed a receipt');
  assert.equal(receiptOfPayment({ payments: pays, paymentId: 'p4', agreedCentavos: 3_000_000 }), null, 'a refused payment printed a receipt');
  assert.equal(receiptOfPayment({ payments: pays, paymentId: 'nope', agreedCentavos: null }), null);
  const first = receiptOfPayment({ payments: pays, paymentId: 'p1', agreedCentavos: 3_000_000 })!;
  assert.equal(first.whatFor, 'First payment');
  assert.equal(first.paidCentavos, 900_000, 'a later payment changed an older receipt');
  assert.equal(first.leftCentavos, 2_100_000);
  const second = receiptOfPayment({ payments: pays, paymentId: 'p2', agreedCentavos: null })!;
  assert.equal(second.paidCentavos, 1_500_000);
  assert.equal(second.leftCentavos, null, 'what is left was worked out with no accepted quote');
});

test('2 · the slip: the row’s figures, “not an official receipt”, no S89R, no Downpayment', () => {
  const r = receiptOfPayment({ payments: [row({})], paymentId: 'p1', agreedCentavos: 900_000 })!;
  const s = paymentReceiptSlip(r, { shop: 'Lumina Studio', eventName: 'Claire & Indalecio', date: (iso) => iso.slice(0, 10) });
  assert.equal(s.lines[0]!.what, 'First payment');
  assert.equal(s.lines[0]!.amount, '9,000.00');
  assert.equal(s.lines[0]!.detail, 'To Lumina Studio · for Claire & Indalecio');
  assert.deepEqual(s.refs, ['Reference GC123']);
  assert.ok(s.rows.some((x) => x.label === 'What is left' && x.value === 'Nothing · paid in full'));
  assert.equal(s.legal, paymentReceiptLegal('Lumina Studio'));
  assert.match(s.legal, /not an official receipt/, 'Setnayan did not sell this — the slip must not read as an OR');
  const all = JSON.stringify(s);
  assert.doesNotMatch(all, /S89R|Downpayment|₱0(?![\d,.])/);
  const noLeft = paymentReceiptSlip({ ...r, leftCentavos: null }, { shop: 'Lumina Studio', eventName: null, date: (i) => i });
  assert.ok(!noLeft.rows.some((x) => x.label === 'What is left'), 'what is left was said without an accepted quote');
  assert.equal(noLeft.lines[0]!.detail, 'To Lumina Studio');
});

test('3 · the page: hosts only, a refused read is not found, the slip has no number of its own', () => {
  // The host check and every "not found" are decided by the slip's gate (awaited by its layout before streaming).
  const page = src('app/receipts/payment/[paymentId]/gate.ts') + src('app/receipts/payment/[paymentId]/page.tsx');
  assert.match(page, /\.eq\('member_type', 'couple'\)\.maybeSingle\(\)/, 'the host check is gone — a coordinator or supplier could open the PDF');
  assert.match(page, /if \(!host\.data\) notFound\(\);/);
  assert.match(page, /if \(payments\.error \|\| quote\.error\) \{[\s\S]*?notFound\(\);/, 'a refused read drew a slip missing what is left');
  assert.match(page, /number=\{null\}/);
  assert.match(page, /stamp="paid"/);
  const slip = src('app/receipts/_components/receipt-slip.tsx');
  assert.match(slip, /\{number \? <p/, 'a null number still prints “No.”');
});
