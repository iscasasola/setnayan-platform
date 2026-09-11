/**
 * export-payment-ledger — how a ledger row reads in the couple's RA 10173 file.
 * Completeness of the projection is T14 in lib/export-coverage-guardrail.test.ts;
 * the couple scoping is T15 there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEDGER_EXPORT_FIELDS,
  LEDGER_EXPORT_OMITTED,
  LEDGER_SUPPLIER_PROJECTION,
  RECEIPT_LINK_TTL_SECONDS,
  shapeLedgerRows,
} from '@/lib/export-payment-ledger';

const row = (over: Record<string, unknown> = {}) => ({
  payment_id: 'p1',
  event_id: 'e1',
  vendor_id: 'b1',
  amount_php: 25000,
  paid_at: '2026-09-05T08:30:00Z',
  method: 'BPI transfer',
  proof_r2_key: null,
  ...over,
});

test('each payment names the supplier it was paid to', () => {
  const [r] = shapeLedgerRows([row()], [{ vendor_id: 'b1', vendor_name: 'Hiraya Catering', category: 'catering' }], new Map());
  assert.deepEqual(r!.paid_to, { business_name: 'Hiraya Catering', category: 'catering' });
});

test('a booking the name read did not return is null, never a guess', () => {
  const [r] = shapeLedgerRows([row()], [], new Map());
  assert.equal(r!.paid_to, null);
});

test('a receipt comes with a working link AND the moment it stops working', () => {
  const links = new Map([['p1', { url: 'https://r2.example/receipt?sig=x', expiresAt: '2026-09-12T00:00:00Z' }]]);
  const [r] = shapeLedgerRows([row({ proof_r2_key: 'r2://thread-files/payment-proof/events/e1/a.jpg' })], [], links);
  assert.equal(r!.receipt_link, 'https://r2.example/receipt?sig=x');
  assert.equal(r!.receipt_link_expires_at, '2026-09-12T00:00:00Z');
  assert.equal(r!.proof_r2_key, 'r2://thread-files/payment-proof/events/e1/a.jpg', 'the durable key stays');
  assert.equal('receipt_link_note' in r!, false);
});

test('a receipt whose link could not be made says so — never a silent null', () => {
  const [r] = shapeLedgerRows([row({ proof_r2_key: 'r2://thread-files/payment-proof/events/e1/a.jpg' })], [], new Map());
  assert.equal(r!.receipt_link, null);
  assert.match(String(r!.receipt_link_note), /could not be made/);
});

test('no receipt, no link and no note', () => {
  const [r] = shapeLedgerRows([row()], [], new Map());
  assert.equal(r!.receipt_link, null);
  assert.equal('receipt_link_note' in r!, false);
});

test('the three withheld ids are other people’s, and never in the projection', () => {
  assert.deepEqual(Object.keys(LEDGER_EXPORT_OMITTED).sort(), [
    'payment_dispute_settled_by_user_id',
    'payment_refused_by_user_id',
    'vendor_confirmed_by',
  ]);
  for (const c of Object.keys(LEDGER_EXPORT_OMITTED)) assert.ok(!LEDGER_EXPORT_FIELDS.includes(c), c);
  // …while what those people RECORDED is the subject's to read.
  for (const c of ['vendor_confirmed_at', 'payment_refusal_reason', 'payment_dispute_outcome', 'payment_dispute_note']) {
    assert.ok(LEDGER_EXPORT_FIELDS.includes(c), c);
  }
  assert.equal(LEDGER_SUPPLIER_PROJECTION, 'vendor_id, vendor_name, category', 'the supplier read stays narrow');
  assert.equal(RECEIPT_LINK_TTL_SECONDS, 86400);
});
