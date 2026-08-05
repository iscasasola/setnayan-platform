import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReference,
  compareReferences,
  classifyDuplicate,
  MIN_CONTAINMENT_LENGTH,
} from './payment-reference-match';

/**
 * The duplicate-reference rule, tested where it is cheap.
 *
 * Owner, 2026-08-05: *"must also detect if reference number is used twice."*
 *
 * 🔑 THE RISK IS SYMMETRIC AND BOTH SIDES ARE SILENT. Too loose and one
 * transfer settles two orders. Too tight and honest payers are blocked — a
 * corrected screenshot, a lump sum covering two purchases, a BDO transfer whose
 * code wraps ours. Neither failure raises an error; both just look like the
 * system working.
 */

const prior = (over: Partial<Parameters<typeof classifyDuplicate>[0]['priors'][number]> = {}) => ({
  paymentId: 'p-old',
  orderId: 'order-A',
  referenceNumber: 'GC123456789',
  status: 'matched',
  ...over,
});

test('the same code typed differently is the same transfer', () => {
  // A payer copies from GCash, an admin retypes from a BDO alert. If spacing or
  // case defeated the check it would never fire in real life — which is
  // indistinguishable from having no check at all.
  assert.equal(compareReferences('GC 123 456 789', 'gc123456789'), 'exact');
  assert.equal(compareReferences('ABC-1234-5678', 'abc12345678'), 'exact');
  assert.equal(normalizeReference(' gc-123 '), 'GC123');
});

test('a bank reference that WRAPS ours is flagged, not missed', () => {
  // 🔑 THE BDO SHAPE. Ours ends with theirs. Exact matching would miss every
  // cross-bank payment, which is the majority of the large ones.
  assert.equal(compareReferences('SN9F2A11C4', '9F2A11C4'), 'contained');
  assert.equal(compareReferences('9F2A11C4', 'REF:SN9F2A11C4/2026'), 'contained');
});

test('short codes do not accuse each other', () => {
  // A false accusation on a money screen costs the admin's trust in every later
  // warning, so containment needs enough characters to mean something.
  const short = 'A'.repeat(MIN_CONTAINMENT_LENGTH - 1);
  assert.equal(compareReferences(short, `XX${short}XX`), 'none');
  assert.equal(compareReferences('123', '81234'), 'none');
});

test('an empty reference matches nothing', () => {
  // Otherwise every proofless row would "match" every other proofless row.
  assert.equal(compareReferences('', 'GC123456789'), 'none');
  assert.equal(compareReferences(null, null), 'none');
  assert.equal(compareReferences('  --  ', 'GC123456789'), 'none');
});

test('the same transfer twice on the SAME order is refused outright', () => {
  // 🚨 THE ONE CASE THAT IS ALWAYS WRONG. The shortfall guard adds up what
  // payers CLAIM they sent. Two rows describing one ₱1,000 transfer reach
  // ₱2,000 and promote an order that was half paid.
  const v = classifyDuplicate({
    reference: 'GC123456789',
    orderId: 'order-A',
    priors: [prior()],
  });
  assert.equal(v.kind, 'refuse');
});

test('the same transfer on a DIFFERENT order warns — it may be one lump sum', () => {
  const v = classifyDuplicate({
    reference: 'GC123456789',
    orderId: 'order-B',
    priors: [prior({ orderId: 'order-A' })],
  });
  assert.equal(v.kind, 'warn');
  if (v.kind === 'warn') {
    assert.equal(v.otherOrderId, 'order-A');
    assert.equal(v.match, 'exact');
  }
});

test('a REJECTED prior does not warn — that is the re-send we asked for', () => {
  // 🔑 THE FLOW THIS PROTECTS. When an admin presses "send me a clearer
  // picture", the correction is a new row carrying the SAME real reference.
  // Warning here would fire on every honest fix and train the admin to click
  // through warnings — which is worse than having none.
  const v = classifyDuplicate({
    reference: 'GC123456789',
    orderId: 'order-A',
    priors: [prior({ status: 'rejected' })],
  });
  assert.equal(v.kind, 'clear');
});

test('a same-order refusal outranks a cross-order warning, whatever the order of rows', () => {
  // The dangerous verdict must win even when the harmless one is found first,
  // or a row list in a different sequence silently downgrades a refusal.
  const v = classifyDuplicate({
    reference: 'GC123456789',
    orderId: 'order-A',
    priors: [prior({ paymentId: 'p-other', orderId: 'order-B' }), prior({ paymentId: 'p-same' })],
  });
  assert.equal(v.kind, 'refuse');
  if (v.kind === 'refuse') assert.equal(v.priorPaymentId, 'p-same');
});

test('a genuinely new reference is clear', () => {
  const v = classifyDuplicate({
    reference: 'GC999888777',
    orderId: 'order-A',
    priors: [prior()],
  });
  assert.equal(v.kind, 'clear');
});

test('a pending prior does not count — only money already counted can double-count', () => {
  // Two rows both awaiting review are not yet money. Refusing here would block
  // the admin from clearing the first one.
  const v = classifyDuplicate({
    reference: 'GC123456789',
    orderId: 'order-A',
    priors: [prior({ status: 'pending' })],
  });
  assert.equal(v.kind, 'clear');
});
