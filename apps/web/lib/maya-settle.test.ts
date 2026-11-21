/**
 * 💳 The Maya settle path (owner 2026-11-21, rule 5) — with Maya and the database faked.
 *
 *   · verified paid → approved ONCE; a repeated webhook does nothing;
 *   · an amount (or reference, currency) mismatch → queued for the admin, never approved;
 *   · Maya's API unreachable after a webhook said paid → queued; after a mere return → nothing;
 *   · a webhook body is never believed: only what `verifyById` returns counts;
 *   · a supplier plan (needs an admin's session to switch on) → queued, not approved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { settleMayaPayment, mayaIdempotencyKey, type MayaCheckoutRow, type MayaSettleDeps, type OwedNow } from '@/lib/maya-settle';
import type { MayaPaymentLike } from '@/lib/maya-checkout';

const REF = 'SN12345678';
const PAID: MayaPaymentLike = { id: 'chk-1', status: 'PAYMENT_SUCCESS', isPaid: true, amount: 1499.5, currency: 'PHP', requestReferenceNumber: REF };

function world(opts: {
  maya?: MayaPaymentLike | null | 'error';
  owed?: OwedNow | null | 'error';
  approve?: { ok: true } | { ok: false; message: string };
} = {}) {
  const row: MayaCheckoutRow = {
    checkout_id: 'chk-1', order_id: 'ord-1', user_id: 'usr-1', request_reference_number: REF,
    amount_php: 1499.5, environment: 'sandbox', status: 'created', maya_payment_id: null, payment_id: null,
  };
  const payments = new Map<string, { paymentId: string; status: string; note: string; amountPhp: number }>();
  const log = { approves: 0, notices: 0, verifies: 0 };
  const deps: MayaSettleDeps = {
    async findCheckout(h) {
      return h.checkoutId === row.checkout_id || h.mayaPaymentId === row.maya_payment_id || h.reference === REF ? row : null;
    },
    async owedNow() {
      return opts.owed === undefined ? { amountPhp: 1499.5, status: 'awaiting_payment', needsAdminToActivate: false } : opts.owed;
    },
    async verifyById() {
      log.verifies++;
      return opts.maya === undefined ? PAID : opts.maya;
    },
    async verifyByReference() {
      log.verifies++;
      const m = opts.maya === undefined ? PAID : opts.maya;
      return m === 'error' ? 'error' : m ? [m] : [];
    },
    async upsertPayment(a) {
      const key = mayaIdempotencyKey(a.mayaPaymentId);
      const prior = payments.get(key);
      if (prior) return { paymentId: prior.paymentId, status: prior.status };
      const p = { paymentId: `pay-${payments.size + 1}`, status: 'pending', note: a.note, amountPhp: a.amountPhp };
      payments.set(key, p);
      return { paymentId: p.paymentId, status: p.status };
    },
    async updateCheckout(_id, patch) {
      Object.assign(row, patch);
    },
    async approve({ paymentId }) {
      log.approves++;
      const out = opts.approve ?? { ok: true };
      if (out.ok) for (const p of payments.values()) if (p.paymentId === paymentId) p.status = 'matched';
      return out;
    },
    async notifyAdmins() {
      log.notices++;
    },
  };
  return { deps, row, payments, log };
}

test('verified paid → approved once; the repeat webhook is a no-op', async () => {
  const w = world();
  const first = await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true });
  assert.deepEqual(first, { outcome: 'approved', paymentId: 'pay-1' });
  assert.equal(w.row.status, 'approved');
  assert.equal(w.row.maya_payment_id, 'chk-1');
  const again = await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true });
  assert.deepEqual(again, { outcome: 'already', paymentId: 'pay-1' });
  // …and the payer's return after the webhook changes nothing either.
  const back = await settleMayaPayment(w.deps, { reference: REF });
  assert.equal(back.outcome, 'already');
  assert.equal(w.log.approves, 1, 'approved exactly once');
  assert.equal(w.payments.size, 1, 'one Maya payment is one payment row');
});

test('amount mismatch → queued with the reason, never approved', async () => {
  const w = world({ maya: { ...PAID, amount: 1000 } });
  const r = await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true });
  assert.equal(r.outcome, 'queued');
  assert.match(r.outcome === 'queued' ? r.reason : '', /₱1,000/);
  assert.equal(w.log.approves, 0);
  assert.equal(w.row.status, 'queued');
  assert.equal([...w.payments.values()][0]!.status, 'pending', 'it waits in the admin queue');
  // A repeat of the same mismatch does not re-queue or re-notify.
  const notices = w.log.notices;
  assert.equal((await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true })).outcome, 'already');
  assert.equal(w.log.notices, notices);
});

test('reference or currency mismatch → queued', async () => {
  for (const bad of [{ requestReferenceNumber: 'SN00000000' }, { currency: 'USD' }]) {
    const w = world({ maya: { ...PAID, ...bad } });
    assert.equal((await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' })).outcome, 'queued');
    assert.equal(w.log.approves, 0);
  }
});

test('the order now owes something else → queued, even though Maya matches the checkout', async () => {
  const w = world({ owed: { amountPhp: 2000, status: 'awaiting_payment', needsAdminToActivate: false } });
  const r = await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' });
  assert.equal(r.outcome, 'queued');
  assert.equal(w.log.approves, 0);
});

test('a supplier plan → queued for an admin press (activation needs an admin session)', async () => {
  const w = world({ owed: { amountPhp: 1499.5, status: 'awaiting_payment', needsAdminToActivate: true } });
  assert.equal((await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' })).outcome, 'queued');
  assert.equal(w.log.approves, 0);
});

test('unverifiable after a webhook said paid → queued; after a return → nothing written', async () => {
  const hook = world({ maya: 'error' });
  const r = await settleMayaPayment(hook.deps, { mayaPaymentId: 'chk-1', claimedPaid: true });
  assert.deepEqual(r, { outcome: 'unverifiable', queued: true });
  assert.equal(hook.log.approves, 0);
  assert.equal(hook.payments.size, 1);
  assert.match([...hook.payments.values()][0]!.note, /could not be reached/);

  const ret = world({ maya: 'error' });
  assert.deepEqual(await settleMayaPayment(ret.deps, { reference: REF }), { outcome: 'unverifiable', queued: false });
  assert.equal(ret.payments.size, 0, 'a typed ?maya=success never creates a payment');
});

test('a queued unverifiable payment approves itself once Maya answers', async () => {
  const opts: { maya?: MayaPaymentLike | 'error' } = { maya: 'error' };
  const w = world(opts as never);
  await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true });
  // Maya's retry arrives and the API now answers PAID.
  w.deps.verifyById = async () => PAID;
  assert.equal((await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true })).outcome, 'approved');
  assert.equal(w.log.approves, 1);
});

test('the webhook body is never the verdict — Maya\'s API says pending, nothing moves', async () => {
  const w = world({ maya: { ...PAID, status: 'PAYMENT_PROCESSING' } });
  assert.deepEqual(await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true }), { outcome: 'pending' });
  assert.equal(w.payments.size, 0);
  assert.equal(w.log.approves, 0);
});

test('failed / expired at Maya → the checkout closes; no payment row', async () => {
  const w = world({ maya: { ...PAID, status: 'PAYMENT_EXPIRED' } });
  assert.deepEqual(await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' }), { outcome: 'closed', status: 'expired' });
  assert.equal(w.row.status, 'expired');
  assert.equal(w.payments.size, 0);
});

test('not one of our checkouts → nothing is asked or written', async () => {
  const w = world();
  assert.deepEqual(await settleMayaPayment(w.deps, { mayaPaymentId: 'someone-elses' }), { outcome: 'unknown' });
  assert.equal(w.log.verifies, 0);
});

test('approvePaymentCore refusing (duplicate, shortfall) → queued with its message', async () => {
  const w = world({ approve: { ok: false, message: 'Reference already counted on this order' } });
  const r = await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' });
  assert.equal(r.outcome, 'queued');
  assert.equal(w.row.status, 'queued');
});

test('the verdict is cached on the row: an approved checkout is not asked about again', async () => {
  const w = world();
  await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' });
  const asked = w.log.verifies;
  w.row.verified_at = new Date().toISOString();
  assert.equal((await settleMayaPayment(w.deps, { reference: REF })).outcome, 'already');
  assert.equal(w.log.verifies, asked, 'a reload of ?maya=success called Maya again');
});

test('a "not yet" is reused for a few seconds — Maya is not asked on every 3-second re-check', async () => {
  const w = world({ maya: { ...PAID, status: 'PAYMENT_PROCESSING' } });
  assert.deepEqual(await settleMayaPayment(w.deps, { reference: REF }), { outcome: 'pending' });
  const asked = w.log.verifies;
  assert.ok(w.row.last_checked_at, 'the ask was not stamped');
  assert.deepEqual(await settleMayaPayment(w.deps, { reference: REF }), { outcome: 'pending' });
  assert.equal(w.log.verifies, asked, 'Maya was asked again inside the window');
  // …but a webhook saying "paid" always asks.
  w.deps.verifyById = async () => PAID;
  assert.equal((await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1', claimedPaid: true })).outcome, 'approved');
});

test('a closed checkout stays closed — not asked again', async () => {
  const w = world({ maya: { ...PAID, status: 'PAYMENT_FAILED' } });
  await settleMayaPayment(w.deps, { mayaPaymentId: 'chk-1' });
  const asked = w.log.verifies;
  assert.deepEqual(await settleMayaPayment(w.deps, { reference: REF }), { outcome: 'closed', status: 'failed' });
  assert.equal(w.log.verifies, asked);
});

test('no payment at Maya for this reference → "none": they opened Maya and came back without paying — a fresh try', async () => {
  const w = world({ maya: null });
  assert.deepEqual(await settleMayaPayment(w.deps, { reference: REF }), { outcome: 'none' });
  assert.equal(w.payments.size, 0);
});
