/**
 * lib/maya-settle.ts — ONE path from "Maya might have been paid" to a payment
 * that is approved, queued for an admin, or left alone.
 *
 * Both doors call it: the webhook (`app/api/webhooks/maya/route.ts`) and the
 * payer's return to `/pay/[reference]?maya=success` (the webhook may be late).
 * Its inputs are only HINTS — a payment id and/or our reference. Nothing a
 * caller passes is believed: the answer always comes from Maya's API, asked
 * with our SECRET key (`deps.verifyById` / `deps.verifyByReference`).
 *
 * ⚖ OWNER 2026-11-21, rule 5, in the order this file applies it:
 *   · approve ONLY on `judgeMayaPayment` → 'paid' (PAYMENT_SUCCESS, PHP, our
 *     exact reference, the exact amount the order is owed today);
 *   · idempotent on Maya's payment id — the payment row carries
 *     `client_idempotency_key = 'maya:<id>'` (UNIQUE per order) and only a
 *     row still `pending` can be approved, so a repeated webhook does nothing;
 *   · any mismatch → the payment waits in /admin/payments with the reason;
 *   · approval goes through `approvePaymentCore` with the gateway actor, so the
 *     receipt, notices, ledger, payouts and activation run exactly as for a
 *     manual approval.
 *
 * The database and Maya are injected (`MayaSettleDeps`) so this logic runs in
 * unit tests with no network and no database. The real wiring is
 * `mayaSettleDeps` in lib/maya-checkout.server.ts.
 */
import {
  MAYA_CHANNEL,
  judgeMayaPayment,
  judgeMayaPayments,
  mayaApprovedNote,
  type MayaEnvironment,
  type MayaPaymentLike,
  type MayaVerdict,
} from '@/lib/maya-checkout';
import { formatPhp } from '@/lib/php';

export type MayaCheckoutRow = {
  checkout_id: string;
  order_id: string;
  user_id: string;
  request_reference_number: string;
  amount_php: number;
  environment: MayaEnvironment;
  status: string;
  maya_payment_id: string | null;
  payment_id: string | null;
  /** Set once Maya's API has given a verdict on this checkout (never by an unverifiable queue). */
  verified_at?: string | null;
  /** When Maya's API last answered "not yet" (a real pending) about this checkout. */
  last_checked_at?: string | null;
  created_at?: string | null;
};

/** What the order is owed NOW — read through the same resolver the pay page uses. */
export type OwedNow = {
  amountPhp: number;
  /** 'awaiting_payment' is the only status a payment may settle. */
  status: string;
  /** A supplier plan's activation needs an admin's own session (see sku-activation). */
  needsAdminToActivate: boolean;
  /** Whose order it is (`orders.user_id`) — on SANDBOX keys the owner must be internal too, not only the payer. */
  ownerUserId: string | null;
};

export type ApproveOutcome = { ok: true } | { ok: false; message: string };

export type MayaSettleDeps = {
  findCheckout(hint: { checkoutId?: string | null; mayaPaymentId?: string | null; reference?: string | null }):
    Promise<MayaCheckoutRow | null | 'error'>;
  owedNow(reference: string): Promise<OwedNow | null | 'error'>;
  /** Maya's API, secret key. `'error'` = could not ask (no key, network, non-2xx). */
  verifyById(mayaPaymentId: string): Promise<MayaPaymentLike | null | 'error'>;
  verifyByReference(reference: string): Promise<MayaPaymentLike[] | 'error'>;
  /**
   * Insert (or find) the ONE payment row for this Maya payment id. Returns the
   * row's id and status; an existing row is returned as it is (the idempotency).
   */
  upsertPayment(args: {
    orderId: string;
    userId: string;
    amountPhp: number;
    mayaPaymentId: string;
    note: string;
  }): Promise<{ paymentId: string; status: string } | 'error'>;
  updateCheckout(
    checkoutId: string,
    patch: Partial<MayaCheckoutRow> & { outcome_reason?: string | null; paid_with?: string | null; last_checked_at?: string },
  ): Promise<void>;
  approve(args: { paymentId: string; buyerUserId: string; note: string }): Promise<ApproveOutcome>;
  /** Is this account internal (`users.is_internal`)? Only they may be approved on SANDBOX keys. */
  buyerIsInternal(userId: string): Promise<boolean>;
  /** The admins are told whenever money is waiting for them (approved or queued). */
  notifyAdmins(args: { orderId: string; amountPhp: number }): Promise<void>;
};

export type MayaSettleResult =
  /** Approved now, by this call. */
  | { outcome: 'approved'; paymentId: string }
  /** Already approved / already queued — a repeat. Nothing was written. */
  | { outcome: 'already'; paymentId: string | null }
  /** Waiting in /admin/payments with the reason. */
  | { outcome: 'queued'; paymentId: string | null; reason: string }
  /** Maya says not paid (failed, expired, cancelled). */
  | { outcome: 'closed'; status: 'failed' | 'expired' | 'cancelled' }
  /** Not settled at Maya yet. */
  | { outcome: 'pending' }
  /** Maya has no payment for this reference at all — they opened Maya and came back without paying. */
  | { outcome: 'none' }
  /** Not one of our checkouts. Nothing to do. */
  | { outcome: 'unknown' }
  /** We could not ask Maya or read our own rows. Nothing approved. */
  | { outcome: 'unverifiable'; queued: boolean };

/**
 * Settle one Maya payment.
 *
 * @param hint.claimedPaid  TRUE only when Maya's webhook said PAYMENT_SUCCESS.
 *   If we then CANNOT reach Maya's API, the money may be real, so it is queued
 *   for the admin with that reason (rule 5: "unverifiable → queued"). A payer's
 *   return (`?maya=success`, a forgeable address) never queues on its own.
 */
export async function settleMayaPayment(
  deps: MayaSettleDeps,
  hint: { mayaPaymentId?: string | null; reference?: string | null; claimedPaid?: boolean },
): Promise<MayaSettleResult> {
  const mayaId = hint.mayaPaymentId?.trim() || null;
  const reference = hint.reference?.trim() || null;
  if (!mayaId && !reference) return { outcome: 'unknown' };

  // 1 · Is this one of OUR checkouts? (Maya's guide: checkoutId = paymentId.)
  const row = await deps.findCheckout({ checkoutId: mayaId, mayaPaymentId: mayaId, reference });
  if (row === 'error') return { outcome: 'unverifiable', queued: false };
  if (!row) return { outcome: 'unknown' };

  // 1b · THE VERDICT IS CACHED ON THE ROW (ship review 21 Nov, item 8). Approved, or queued AFTER Maya answered,
  // is final for this checkout: a reload of `?maya=success` or a repeated webhook does not ask Maya again. A queue
  // made because Maya could NOT be reached has no `verified_at`, so it is asked again — that is how it clears.
  const sameMayaPayment = !mayaId || mayaId === row.maya_payment_id || mayaId === row.checkout_id;
  if (sameMayaPayment && row.payment_id && (row.status === 'approved' || (row.status === 'queued' && row.verified_at))) {
    return { outcome: 'already', paymentId: row.payment_id };
  }
  // A closed checkout (failed / expired / cancelled) stays closed — not asked again on a page visit. A WEBHOOK saying
  // paid is always asked about (ship review @56bc3a26f, item 5): a checkout we expired by the clock may still be paid
  // at Maya, and "closed" there would take the money with nothing recorded and nobody told.
  if (!hint.claimedPaid && sameMayaPayment && row.verified_at &&
      (row.status === 'failed' || row.status === 'expired' || row.status === 'cancelled')) {
    return { outcome: 'closed', status: row.status as 'failed' | 'expired' | 'cancelled' };
  }
  // 🧊 THROTTLE (ship review 21 Nov, item 5): a checkout Maya called "not yet" a few seconds ago is "not yet" again —
  // the "Checking…" page re-asks every 3 s, and a payer may reload; Maya is asked at most once per window per row.
  // A webhook (claimedPaid) always asks: that is Maya telling us something changed.
  if (!hint.claimedPaid && row.status === 'created' && row.last_checked_at &&
      Date.now() - Date.parse(row.last_checked_at) < MAYA_RECHECK_MS) {
    return { outcome: 'pending' };
  }

  // 2 · Ask Maya. By the id when we have one, else by our reference.
  let verdict: MayaVerdict | 'error';
  const expected = { reference: row.request_reference_number, amountPhp: Number(row.amount_php) };
  if (mayaId) {
    const p = await deps.verifyById(mayaId);
    verdict = p === 'error' ? 'error' : p ? judgeMayaPayment(p, expected) : { kind: 'unstarted', mayaPaymentId: null };
  } else {
    const list = await deps.verifyByReference(row.request_reference_number);
    verdict = list === 'error' ? 'error' : list.length === 0 ? { kind: 'unstarted', mayaPaymentId: null } : judgeMayaPayments(list, expected);
  }

  if (verdict === 'error') {
    if (!hint.claimedPaid || !mayaId) return { outcome: 'unverifiable', queued: false };
    const reason =
      'Maya’s webhook said paid, but Maya’s API could not be reached to confirm it. Check the Maya dashboard before approving.';
    const pay = await deps.upsertPayment({
      orderId: row.order_id,
      userId: row.user_id,
      amountPhp: Number(row.amount_php),
      mayaPaymentId: mayaId,
      note: reason,
    });
    if (pay === 'error') return { outcome: 'unverifiable', queued: false };
    if (pay.status === 'pending') {
      await deps.updateCheckout(row.checkout_id, { status: 'queued', payment_id: pay.paymentId, outcome_reason: reason });
      await deps.notifyAdmins({ orderId: row.order_id, amountPhp: Number(row.amount_php) });
    }
    return { outcome: 'unverifiable', queued: true };
  }

  // Nothing submitted at Maya: a fresh try. A checkout older than Maya's session lifetime will never be paid, so it
  // is closed here (expired) and not asked about again — this is what bounds the open-checkout re-check (item 5).
  if (verdict.kind === 'unstarted') {
    if (row.status === 'created' && row.created_at && Date.now() - Date.parse(row.created_at) > MAYA_CHECKOUT_OPEN_MS) {
      await deps.updateCheckout(row.checkout_id, { status: 'expired', verified_at: new Date().toISOString() });
    }
    return { outcome: 'none' };
  }
  // Only a REAL "not yet" is remembered for the throttle (item 3).
  if (verdict.kind === 'pending') {
    if (row.status === 'created') await deps.updateCheckout(row.checkout_id, { last_checked_at: new Date().toISOString() });
    return { outcome: 'pending' };
  }
  if (verdict.kind === 'closed') {
    if (row.status === 'created') {
      await deps.updateCheckout(row.checkout_id, {
        status: verdict.status === 'expired' ? 'expired' : verdict.status === 'cancelled' ? 'cancelled' : 'failed',
        maya_payment_id: verdict.mayaPaymentId ?? row.maya_payment_id,
        verified_at: new Date().toISOString(),
      });
    }
    return { outcome: 'closed', status: verdict.status };
  }

  // 3 · Maya says paid. Does it agree with what the order is owed NOW?
  const owed = await deps.owedNow(row.request_reference_number);
  let reason: string | null = verdict.kind === 'mismatch' ? verdict.reason : null;
  if (!reason) {
    if (owed === 'error' || owed === null) {
      reason = 'Maya confirmed the payment, but the order could not be read to check it.';
    } else if (owed.status !== 'awaiting_payment') {
      reason = `Maya confirmed the payment, but the order is no longer waiting for one (${owed.status}).`;
    } else if (Math.round(owed.amountPhp * 100) !== Math.round(Number(row.amount_php) * 100)) {
      reason = `Maya confirmed ${formatPhp(Number(row.amount_php))}, but the order now owes ${formatPhp(owed.amountPhp)}.`;
    } else if (owed.needsAdminToActivate) {
      reason = 'Paid and confirmed by Maya. A supplier plan needs an admin’s press to switch on.';
    } else if (
      row.environment === 'sandbox' &&
      !(owed.ownerUserId && (await deps.buyerIsInternal(row.user_id)) && (await deps.buyerIsInternal(owed.ownerUserId)))
    ) {
      // 🔒 A SANDBOX "PAID" MOVED NO MONEY (ship review @019beef4a, HIGH). Only an internal account's test, on an
      // internal account's OWN order, may approve itself (ship review @3ca46aa6e, item 3: an internal coordinator paying
      // a real couple's order is still a test card). Anyone else's order — or an owner we could not read — waits for an
      // admin: never activated, receipted or paid out on a test card.
      reason = 'Sandbox payment — Maya test keys, no money moved. Approve only if this was a test.';
    }
  }

  const id = verdict.mayaPaymentId;
  if (!id) return { outcome: 'pending' };
  const amountPhp = verdict.amountPhp ?? Number(row.amount_php);
  // A payment row needs a positive amount; a mismatch with no usable figure
  // carries the checkout's (what we asked Maya for) and the reason says why.
  const pay = await deps.upsertPayment({
    orderId: row.order_id,
    userId: row.user_id,
    amountPhp: amountPhp > 0 ? amountPhp : Number(row.amount_php),
    mayaPaymentId: id,
    note: reason ?? mayaApprovedNote(id, row.environment),
  });
  if (pay === 'error') return { outcome: 'unverifiable', queued: false };

  // 🔑 THE IDEMPOTENCY. Only a row still pending can move; a repeat finds it
  // matched (or rejected by an admin) and does nothing.
  if (pay.status !== 'pending') return { outcome: 'already', paymentId: pay.paymentId };
  if (reason && row.status === 'queued' && row.payment_id === pay.paymentId) {
    return { outcome: 'already', paymentId: pay.paymentId };
  }

  const stamp = {
    maya_payment_id: id,
    payment_id: pay.paymentId,
    verified_at: new Date().toISOString(),
    paid_with: verdict.kind === 'paid' ? verdict.paidWith : null,
  };
  if (reason) {
    await deps.updateCheckout(row.checkout_id, { ...stamp, status: 'queued', outcome_reason: reason });
    await deps.notifyAdmins({ orderId: row.order_id, amountPhp });
    return { outcome: 'queued', paymentId: pay.paymentId, reason };
  }

  const approved = await deps.approve({
    paymentId: pay.paymentId,
    buyerUserId: row.user_id,
    note: mayaApprovedNote(id, row.environment),
  });
  if (!approved.ok) {
    await deps.updateCheckout(row.checkout_id, { ...stamp, status: 'queued', outcome_reason: approved.message.slice(0, 500) });
    await deps.notifyAdmins({ orderId: row.order_id, amountPhp });
    return { outcome: 'queued', paymentId: pay.paymentId, reason: approved.message };
  }
  await deps.updateCheckout(row.checkout_id, { ...stamp, status: 'approved', outcome_reason: null });
  await deps.notifyAdmins({ orderId: row.order_id, amountPhp });
  return { outcome: 'approved', paymentId: pay.paymentId };
}

/** Maya keeps a checkout open for an hour (developers.maya.ph); a little over, after which an unsubmitted one is dead. */
export const MAYA_CHECKOUT_OPEN_MS = 70 * 60 * 1000;

/** How long a "not yet" from Maya is reused for one checkout before Maya is asked again. */
export const MAYA_RECHECK_MS = 10_000;

/** The idempotency key a Maya payment row carries (UNIQUE per order with order_id). */
export function mayaIdempotencyKey(mayaPaymentId: string): string {
  return `${MAYA_CHANNEL}:${mayaPaymentId}`.slice(0, 64);
}
