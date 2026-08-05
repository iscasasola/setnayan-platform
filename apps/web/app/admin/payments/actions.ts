'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
// Shared admin gate (council fix #1 2026-07-09) — same Forbidden contract the
// local requireAdmin had before it was promoted to lib/admin/require-admin.ts.
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
// Couple referral rewards (2026-07-01). QUALIFYING EVENT = the referred
// couple's FIRST PAID ORDER. Fired best-effort off an after() hook the moment
// an order flips to 'paid' — never blocks or fails the reconciliation flow.
// Idempotent + inert-when-reward-unset (see lib/referrals.ts).
import { qualifyReferralOnFirstPaidOrder } from '@/lib/referrals';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyDuplicate, normalizeReference } from '@/lib/payment-reference-match';
import { emitNotification } from '@/lib/notification-emit';
import {
  formatPhp,
  orderGrossOwed,
  isVatInclusiveServiceKey,
  isDecisivePaymentMatch,
  orderReconciledToPaid,
  shouldProvisionOnApproval,
} from '@/lib/orders';
import { computeVatFromBase, computeVatFromGross } from '@/lib/receipts';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { captureEvent } from '@/lib/analytics';
import { guestReceiptName } from '@/lib/papic-guest-buy';
import {
  computePayoutBreakdown,
  dispatchVendorPayouts,
  getSetnayanFeeBps,
  phpToCentavos,
  releasePayoutHold,
  resolveVendorVerificationState,
} from '@/lib/payouts';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
// Day 3 of the voucher + inline-checkout sprint (CLAUDE.md 2026-05-29 Day 3
// row). All admin payment-state transitions append a row to public.order_ledger
// via the canonical helper. Best-effort writes — never throws, never blocks
// the parent mutation. See lib/ledger.ts for the contract.
import { appendLedger } from '@/lib/ledger';
// Per-SKU activation dispatcher (PR3 hardening). After approvePayment flips an
// order to 'paid', SOME SKUs need a side effect to unlock the capability
// (concierge state machine, Setnayan AI boolean, vendor branch flag). The
// dispatcher owns those hooks behind a frozen, extensible map — non-fatal by
// contract (activateOrderSku never throws). PR4 registers PAPIC_SEATS there,
// never by re-editing approvePayment. Replaces the three hardcoded
// service_key branches that used to live in the promoteOrder block.
//
// Merge note (2026-06-14): main concurrently added the OLD-style inline
// concierge + SETNAYAN_AI + vendor-branch activation to this file; that work
// is fully subsumed by this dispatcher — lib/sku-activation.ts already
// registers `concierge_complete`, `SETNAYAN_AI`, and the branch-prefix hook —
// so main's inline imports/constants are dropped here (typecheck confirms
// nothing else references them).
import { activateOrderSku, deactivateOrderSku } from '@/lib/sku-activation';
import { VENDOR_DEEP_SEARCH_SKU_CODE } from '@/lib/vendor-deep-search-addon';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Notify the buyer — UNLESS the order has no account behind it.
 *
 * A GUEST order (owner-locked 2026-07-29) is minted from a Papic capture
 * surface by someone with no Setnayan account, so `payments.user_id` is NULL and
 * there is nobody to notify: `notifications.user_id` is NOT NULL, and the
 * FK would reject the insert anyway. Their status lives on the bearer-token
 * order page they were handed at checkout (/papic/order/[token]).
 *
 * Silent by design, and safe by contract: every notification on this path is
 * already best-effort — a missing one must never make a fully-successful
 * approval look like a failure to the admin.
 */
async function notifyBuyerIfAny(
  userId: string | null | undefined,
  args: Omit<Parameters<typeof emitNotification>[0], 'userId'>,
): Promise<void> {
  if (!userId) return;
  await emitNotification({ userId, ...args });
}

export async function approvePayment(formData: FormData) {
  const { userId } = await requireAdmin();
  const paymentId = formData.get('payment_id');
  const adminNotes = nullIfBlank(formData.get('admin_notes'));
  const promoteOrder = formData.get('promote_order') === 'on';
  if (typeof paymentId !== 'string') throw new Error('Invalid input');

  const admin = createAdminClient();
  const outcome = await approvePaymentCore({
    admin,
    userId,
    paymentId,
    adminNotes,
    promoteOrder,
    // Only ever true because the admin ticked the box after READING the
    // warning that named the other order. It cannot unlock the same-order
    // case, which the core refuses regardless.
    acknowledgeDuplicate: formData.get('acknowledge_duplicate') === 'on',
  });
  if (!outcome.ok) {
    // Shortfall or duplicate — surface the same inline warn notice + URL the guard used
    // before it was hoisted into the core helper. A NEXT_REDIRECT control exit,
    // so (exactly like the prior in-line throw/redirect) nothing below runs.
    redirect(
      `/admin/payments?filter=all&notice=${encodeURIComponent(outcome.message)}&noticeType=warn`,
    );
  }
  // The admin's OWN views revalidate synchronously so the queue reflects the
  // approval on this response.
  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  // Couple-facing surfaces refresh a beat later, post-response — see the note
  // in approvePaymentCore's provisioning block for why this is deferred.
  after(() => revalidatePath('/dashboard', 'layout'));
}

/**
 * The shared core of admin payment approval. Runs EVERY guard end-to-end — the
 * pending→matched state-machine flip, ledger + notifications, the SHORTFALL
 * GUARD, order promotion, receipt issuance, vendor payouts, and per-SKU
 * provisioning — and RETURNS its outcome instead of redirecting, so both the
 * single-row `approvePayment` action and the `batchApprovePayments` action
 * drive the identical money path:
 *
 *   • `{ ok: true }`             — payment matched (and, when promote+reconciled,
 *                                  the order fully paid + provisioned).
 *   • `{ ok: false, shortfall }` — payment matched but the transfer is short, so
 *                                  the order was NOT promoted/provisioned.
 *
 * Genuine failures (payment already resolved, DB write errors) still THROW —
 * the single action surfaces them as before; the batch action catches them
 * per-row so one bad row never aborts the rest. Callers own revalidation.
 */
export async function approvePaymentCore(args: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  paymentId: string;
  adminNotes: string | null;
  promoteOrder: boolean;
  /**
   * The admin has SEEN a cross-order duplicate warning and confirmed that one
   * real transfer covers both. Never defaults to true: the whole value of the
   * warning is that a human with the bank app open said so.
   *
   * ⚠ Does NOT unlock the same-order case. That one is refused outright,
   * because there is no honest reading of one transfer counted twice against
   * one bill — and the shortfall guard would happily add it up.
   */
  acknowledgeDuplicate?: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; shortfall: true; message: string }
  | { ok: false; duplicate: true; message: string; blocking: boolean }
> {
  const { admin, userId, paymentId, adminNotes, promoteOrder } = args;

  // ---- DUPLICATE REFERENCE (owner, 2026-08-05) ---------------------------
  // Runs BEFORE the flip to 'matched', because after it this row would be its
  // own duplicate — and because refusing a row we already counted is not a
  // refusal.
  //
  // 🔑 A REFERENCE IS NOT UNIQUE, AND MUST NOT BE. Three repeats are honest:
  // the corrected re-send after "send me a clearer picture", one lump sum
  // covering two orders, and the BDO rail where our code wraps theirs. So the
  // rule lives in lib/payment-reference-match.ts and only ONE case is refused
  // outright — the same transfer counted twice against the same bill, which
  // the shortfall guard would otherwise add up into a false "fully paid".
  {
    const { data: me } = await admin
      .from('payments')
      .select('order_id, reference_number')
      .eq('payment_id', paymentId)
      .maybeSingle();
    const mine = me as { order_id: string; reference_number: string | null } | null;
    if (mine && normalizeReference(mine.reference_number) !== '') {
      // Cast a wide net and let the pure rule narrow it: an exact SQL match
      // would miss the BDO shape entirely, which is most large transfers.
      const { data: others } = await admin
        .from('payments')
        .select('payment_id, order_id, reference_number, status')
        .neq('payment_id', paymentId)
        .in('status', ['matched', 'paid']);
      const verdict = classifyDuplicate({
        reference: mine.reference_number,
        orderId: mine.order_id,
        priors: ((others ?? []) as {
          payment_id: string;
          order_id: string;
          reference_number: string | null;
          status: string;
        }[]).map((o) => ({
          paymentId: o.payment_id,
          orderId: o.order_id,
          referenceNumber: o.reference_number,
          status: o.status,
        })),
      });
      if (verdict.kind === 'refuse') {
        return { ok: false, duplicate: true, message: verdict.message, blocking: true };
      }
      if (verdict.kind === 'warn' && !args.acknowledgeDuplicate) {
        return { ok: false, duplicate: true, message: verdict.message, blocking: false };
      }
    }
  }
  // State-machine guard (Task 8 pilot hardening, 2026-06-01): only flip
  // pending → matched. If the row was already matched/rejected (race with
  // another admin, double-click after 503, stale page render), the WHERE
  // clause filters it out and the .single() below raises — surface to the
  // admin as "Payment already resolved" instead of silently re-firing the
  // downstream activation + payout + receipt + notification fan-out.
  const { data: payment, error: pErr } = await admin
    .from('payments')
    .update({
      status: 'matched',
      admin_notes: adminNotes,
      reviewed_by_user_id: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId)
    .eq('status', 'pending')
    .select('order_id, user_id, amount_php')
    .maybeSingle();
  if (pErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Approve payment — mark payment matched',
      file_path: 'app/admin/payments/actions.ts',
      error_message: pErr.message,
      payload_snapshot: { paymentId, promoteOrder },
    });
    throw new Error(pErr.message);
  }
  if (!payment) {
    // Either the payment_id doesn't exist or it's already been resolved.
    // Re-read so we can give the admin a useful message.
    const { data: existing } = await admin
      .from('payments')
      .select('status')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (!existing) throw new Error('Payment not found');
    throw new Error(
      `Payment already resolved (status: ${existing.status}). Refresh the page.`,
    );
  }

  // Look up the order so the notification can link directly + name the order,
  // and so the PostHog `order_paid` event below has `service_key` to slice on.
  const { data: order } = await admin
    .from('orders')
    .select('event_id, public_id, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos')
    .eq('order_id', payment.order_id)
    .maybeSingle();

  // Day 3 voucher sprint: ledger write for the payment_approved transition.
  // Snapshot the amount in centavos + the admin's userId. Best-effort —
  // appendLedger never throws.
  await appendLedger(admin, {
    order_id: payment.order_id,
    event_type: 'payment_approved',
    actor_user_id: userId,
    actor_role: 'admin',
    amount_centavos: Math.round(Number(payment.amount_php) * 100),
    payment_id: paymentId,
    metadata: {
      service_key: order?.service_key ?? null,
      admin_notes: adminNotes,
    },
  });

  // Best-effort — a notification write must NEVER fail the reconciliation.
  // The payment is already matched (the critical write above committed); if
  // notifying the buyer throws, the admin should still see a clean success
  // rather than a 500 that makes them re-click an already-done approval.
  try {
    await notifyBuyerIfAny(payment.user_id, {
      type: 'payment_matched',
      title: `Payment of ${formatPhp(payment.amount_php)} matched`,
      body: adminNotes ?? 'The Setnayan team confirmed your payment.',
      relatedUrl: order?.event_id
        ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
        : null,
    });
  } catch (e) {
    console.error('payment_matched notification failed (non-fatal):', e);
  }

  // Did this approval FULLY reconcile the order to 'paid'? SKU activation below
  // is gated on this (shouldProvisionOnApproval) so a partial/short payment —
  // or an approval with "promote" unchecked — never provisions the full SKU.
  let reconciledToPaid = false;

  if (promoteOrder) {
    // SHORTFALL GUARD (2026-06-25): an order must not be marked fully 'paid'
    // (which issues a receipt + fires vendor payouts) unless the MATCHED payments
    // cover the gross owed — pre-VAT base + 12% VAT, net of any voucher. The
    // payment above is matched either way; a short/partial transfer simply must
    // NOT promote the order. The admin leaves "promote to paid" off to record it
    // as partial, or re-runs once the balance is matched. Closes the audit's
    // "short transfer silently passes on the happy path" gap.
    const { data: orderPayments } = await admin
      .from('payments')
      .select('amount_php, status')
      .eq('order_id', payment.order_id);
    const matchedTotal = (orderPayments ?? [])
      .filter((p) => p.status === 'matched')
      .reduce((acc, p) => acc + Number(p.amount_php), 0);
    if (order && order.requested_total_php != null) {
      const owed = orderGrossOwed({
        requestedTotalPhp: Number(order.requested_total_php),
        confirmedTotalPhp:
          order.confirmed_total_php != null ? Number(order.confirmed_total_php) : null,
        voucherDiscountPhp:
          order.voucher_discount_centavos != null
            ? Number(order.voucher_discount_centavos) / 100
            : 0,
        // Vendor charm prices (₱999 branch add-on, tiers, tokens) are quoted
        // ALL-IN — the stored total already includes VAT, so owed = that total,
        // not total×1.12. Without this the guard demanded base×1.12 and stranded
        // every vendor order "matched but never promoted" (owner-locked
        // 2026-07-05; see isVatInclusiveServiceKey + DECISION_LOG).
        vatInclusive: isVatInclusiveServiceKey(order.service_key),
      });
      reconciledToPaid = orderReconciledToPaid({
        matchedTotalPhp: matchedTotal,
        owedPhp: owed,
      });
      if (!reconciledToPaid) {
        // A short/partial transfer is a NORMAL business case — it must not
        // promote the order, but it must NOT crash the admin with a generic
        // 500 either. The payment is already matched (recorded); surface the
        // "why" as an inline notice on the queue instead of an uncaught throw,
        // so the admin can record it as partial or chase the balance. (Was a
        // `throw new Error(...)` that rendered the generic error page — see
        // DECISION_LOG 2026-07-05.) Returning here (rather than redirecting
        // in-line) is what lets the single + batch callers each surface this
        // their own way; either way activation below does NOT run for a
        // short-paid order, and the order was never promoted.
        const notice =
          `Payment matched, but the order was NOT marked paid: ` +
          `${formatPhp(matchedTotal)} received vs ${formatPhp(owed)} owed (incl. 12% VAT) — ` +
          `${formatPhp(owed - matchedTotal)} short. Leave “Also mark order as paid” unchecked to ` +
          `record it as partial, or promote once the balance is paid.`;
        return { ok: false, shortfall: true, message: notice };
      }
    } else {
      // No stored total to reconcile against (legacy/ad-hoc order with a null
      // requested_total_php). The admin's explicit "promote to paid" governs —
      // there is no shortfall basis to check — so the order does reach 'paid'.
      reconciledToPaid = true;
    }

    // Capture the update result. If this silently failed we'd notify
    // the buyer "your order is paid" while the DB row still says
    // pending — and downstream payout / receipt logic would diverge.
    // Fail loudly so the admin can re-run rather than leaking a
    // half-promoted order.
    const { error: promoteErr } = await admin
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('order_id', payment.order_id);
    if (promoteErr) {
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Approve payment — promote order to paid',
        file_path: 'app/admin/payments/actions.ts',
        error_message: promoteErr.message,
        payload_snapshot: { paymentId, orderId: payment.order_id, serviceKey: order?.service_key ?? null },
      });
      throw new Error(
        `Failed to promote order ${payment.order_id} to paid: ${promoteErr.message}`,
      );
    }

    // Best-effort (same contract as payment_matched above): the order is
    // already promoted to 'paid'; a notification failure must not surface a
    // 500 that makes the admin think the fully-successful approval failed.
    try {
      await notifyBuyerIfAny(payment.user_id, {
        type: 'order_paid',
        title: `Order ${order?.public_id ?? ''} marked paid`,
        body: "Your order is fully paid. We'll start work right away.",
        relatedUrl: order?.event_id
          ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
          : null,
      });
    } catch (e) {
      console.error('order_paid notification failed (non-fatal):', e);
    }

    // Couple referral rewards — QUALIFYING EVENT is this buyer's FIRST PAID
    // ORDER. If they signed up via a ?refc= code, the hook marks their open
    // redemption qualified and (when the admin-managed reward is set) mints the
    // two single-use reward vouchers. after() runs post-response so it never
    // delays the admin's reconciliation click; the helper is best-effort and
    // never throws. Idempotent — the redemption lookup only matches an `open`
    // row, so re-approvals / partial-then-full flows can't double-mint.
    // A GUEST order has no account, so there is no referral to qualify and no
    // person to attribute the funnel event to — skip both rather than passing a
    // null id down two helpers that reasonably assume a buyer exists.
    if (payment.user_id) {
      after(() => qualifyReferralOnFirstPaidOrder(payment.user_id as string));
    }

    // Funnel event — fires the moment an order's status flips to paid.
    // Distinct id is the buyer's Supabase user_id (payment.user_id), so it
    // joins with `signup_completed` / `event_created` for the same person.
    // `sku_key` maps to the order's `service_key` column (closest existing
    // analog; no schema change per the wiring scope).
    try {
      if (payment.user_id) await captureEvent({
        distinctId: payment.user_id,
        event: 'order_paid',
        properties: {
          order_id: payment.order_id,
          amount_php: Number(payment.amount_php),
          sku_key: order?.service_key ?? null,
        },
      });
    } catch {
      // analytics never breaks the admin reconciliation flow.
    }

    // Auto-issue an app transaction receipt — one per order. This is NOT a
    // BIR Official Receipt (the actual BIR OR is issued separately, offline).
    // The unique constraint on receipts.order_id makes the insert idempotent
    // across retries; subsequent runs silently no-op.
    await issueReceiptForOrder({ admin, orderId: payment.order_id });

    // Vendor Payout dispatcher (locked 2026-05-16). If this order is linked
    // to a vendor_profile (vendor_profile_id column on orders, populated by
    // the legacy Setnayan Pay cart flow), schedule the payout rows now.
    // Verified vendors get a single T+1 immediate stage; coming_soon /
    // demoted get the 20/60/20 staged release.
    //
    // No-op when the order isn't a vendor booking (vendor_profile_id NULL)
    // — couples buying Setnayan SKUs don't trigger vendor payouts. Failures
    // here NEVER block the payment-approval flow; payouts can be retried
    // from /admin/payouts.
    //
    // Retired 2026-05-28 V2 cutover — Setnayan Pay 5% convenience fee is
    // retired entirely; Setnayan is now a software publisher, not a
    // marketplace intermediary, and vendor bookings settle directly
    // off-platform with 0% commission. This dispatcher stays wired for any
    // legacy orders still carrying vendor_profile_id; new V2 orders won't
    // route through it.
    try {
      await schedulePayoutsForOrder({
        admin,
        orderId: payment.order_id,
        actorUserId: userId,
      });
    } catch (e) {
      console.error('vendor payout scheduling failed (non-fatal):', e);
    }
  }

  // Per-SKU activation dispatcher (PR3 hardening). Provisions the SKU side
  // effect (SETNAYAN_AI boolean, concierge state machine, vendor branch flag,
  // Papic seats, …).
  //
  // MONEY FIX (c): this MUST fire only when the order actually reaches
  // status='paid' — i.e. the admin promoted it AND the matched payments fully
  // reconcile the amount owed (shouldProvisionOnApproval). A prior "PR4
  // dead-unlock repair" (2026-06-15) moved it OUT of the promote block so it
  // ran on EVERY approval, reasoning that a matched payment = owned capability.
  // But that let approving a ₱1 partial payment (or approving with "promote"
  // unchecked) provision the FULL SKU without full payment — directly
  // contradicting the shortfall notice at the top of the promote block ("the
  // order was NOT marked paid"). Provisioning now tracks 'paid', not merely
  // 'matched'. (The separate ownership-CTA question — checkOrderOwnership()
  // counting a 'submitted' order as owned — is not provisioning and is out of
  // scope here.)
  //
  // Non-fatal by contract — activateOrderSku never throws, so a failed
  // activation leaves a recoverable state (admin re-runs / flips the row
  // manually) but never rolls back the already-approved payment. Hooks are
  // idempotent, so a later re-approval is safe. PR4 registers PAPIC_SEATS by
  // editing lib/sku-activation.ts, NOT this block.
  if (order && shouldProvisionOnApproval({ promoteOrder, reconciledToPaid })) {
    const activationCtx = {
      admin,
      orderId: payment.order_id,
      eventId: order.event_id ?? null,
      serviceKey: order.service_key ?? '',
      actorUserId: userId,
    };
    // Deep Search runs a 10–30s live web + AI pass inside its activation hook.
    // Awaiting it here would hold the admin's Approve click open for the whole
    // run — and a request timeout could strand the order half-activated but
    // re-clickable. Defer it to after(): approval returns fast, and the hook is
    // idempotent (ledger + UNIQUE(order_id) guards) so the post-response run is
    // safe. Every other SKU's hook is fast → stays synchronous so a failure still
    // surfaces on this response.
    if (activationCtx.serviceKey === VENDOR_DEEP_SEARCH_SKU_CODE) {
      after(() => activateOrderSku(activationCtx));
    } else {
      await activateOrderSku(activationCtx);
    }
  }

  // Fully successful. The caller owns revalidation:
  //   • the admin queue (/admin/payments, /admin/payouts) revalidates
  //     synchronously so the row reflects the approval on this response;
  //   • the broad couple-facing `/dashboard` layout revalidate is DEFERRED to
  //     after() by the caller (2026-07-05) — that re-render can hit a
  //     render-time fault in a couple page (Sentry JAVASCRIPT-NEXTJS-B) which
  //     would otherwise surface a generic 500 to the admin even though the
  //     approval fully succeeded, making them re-click an already-done
  //     reconciliation. Post-response it can't. See DECISION_LOG 2026-07-05.
  return { ok: true };
}

/**
 * Server-side re-verification of the DECISIVE-MATCH predicate for one payment.
 * NEVER trust the client's checkbox — a hand-rolled POST could list any
 * payment_id. This re-loads the payment + its order fresh and re-runs the same
 * pure `isDecisivePaymentMatch` the queue used to render the badge, so the
 * batch path can only ever approve rows the server independently agrees are
 * clean. Only `pending` payments are eligible.
 */
async function isPaymentDecisiveById(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('payments')
    .select(
      'status, amount_php, reference_number, order:orders!inner(reference_code, requested_total_php, confirmed_total_php, voucher_discount_centavos, service_key)',
    )
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (!data || data.status !== 'pending') return false;
  const order = (data as unknown as {
    order: {
      reference_code: string | null;
      requested_total_php: number | null;
      confirmed_total_php: number | null;
      voucher_discount_centavos: number | null;
      service_key: string | null;
    } | null;
  }).order;
  if (!order) return false;
  return isDecisivePaymentMatch({
    referenceNumber: (data as { reference_number: string | null }).reference_number,
    referenceCode: order.reference_code,
    amountPhp: Number((data as { amount_php: number }).amount_php),
    requestedTotalPhp: order.requested_total_php,
    confirmedTotalPhp: order.confirmed_total_php,
    voucherDiscountPhp:
      order.voucher_discount_centavos != null ? Number(order.voucher_discount_centavos) / 100 : 0,
    serviceKey: order.service_key,
  });
}

/**
 * Batch-approve every SELECTED clean-match payment.
 *
 * SAFETY MODEL — this is the admin ACTING on rows they've already reviewed, not
 * the system auto-approving on load:
 *   • Only payments the admin explicitly checked are submitted.
 *   • Each id is RE-VERIFIED server-side as a decisive clean match
 *     (isPaymentDecisiveById) before any write — a non-clean / shortfall /
 *     already-resolved row is skipped, never force-approved. This is the
 *     "only rows that pass the decisive-match test are batch-approvable"
 *     guarantee; there is deliberately no select-all-and-force path.
 *   • Approval runs through the SAME approvePaymentCore money path as the
 *     single-row action, so the shortfall guard, receipt, payout, and
 *     provisioning logic are all preserved unchanged. `promoteOrder` is true
 *     because a decisive match by definition fully covers the amount owed — but
 *     if that ever fails to reconcile at write time (stale row, concurrent
 *     partial), the core's shortfall guard still refuses to promote it and it's
 *     reported as a failure, not silently paid.
 *   • Per-row success/failure is aggregated into an inline notice; one bad row
 *     never aborts the rest.
 */
export async function batchApprovePayments(formData: FormData) {
  const { userId } = await requireAdmin();
  const ids = formData
    .getAll('batch_payment_ids')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) {
    redirect(
      `/admin/payments?filter=pending&notice=${encodeURIComponent(
        'No payments were selected.',
      )}&noticeType=warn`,
    );
  }

  const admin = createAdminClient();
  let approved = 0;
  let skipped = 0; // not a clean match at write time (never force-approved)
  let failed = 0; // shortfall / DB error — surfaced, never silently paid

  for (const id of uniqueIds) {
    // Re-verify decisive server-side. A row that isn't a clean match right now
    // is skipped — it keeps its full manual confirm on the queue.
    if (!(await isPaymentDecisiveById(admin, id))) {
      skipped += 1;
      continue;
    }
    try {
      const outcome = await approvePaymentCore({
        admin,
        userId,
        paymentId: id,
        adminNotes: null,
        promoteOrder: true,
      });
      if (outcome.ok) approved += 1;
      // A shortfall (the decisive check should preclude it) or a DUPLICATE
      // REFERENCE. 🔑 A DUPLICATE MUST NEVER CLEAR IN A BATCH: the whole point
      // of the cross-order warning is that a human with the bank app open
      // decides, and `acknowledgeDuplicate` is deliberately not passed here —
      // batch is the one place nobody is reading.
      else failed += 1;
    } catch (e) {
      // Already-resolved (race) or a DB write error — count it, keep going.
      console.error('batchApprovePayments row failed (non-fatal to batch):', id, e);
      failed += 1;
    }
  }

  // Revalidate once for the whole batch — same surfaces the single action
  // refreshes, deferring the broad couple-facing layout to after().
  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  after(() => revalidatePath('/dashboard', 'layout'));

  const parts = [`${approved} approved`];
  if (skipped > 0) parts.push(`${skipped} skipped (no longer a clean match)`);
  if (failed > 0) parts.push(`${failed} failed (review individually)`);
  const noticeType = skipped > 0 || failed > 0 ? 'warn' : 'success';
  redirect(
    `/admin/payments?filter=pending&notice=${encodeURIComponent(
      parts.join(' · '),
    )}&noticeType=${noticeType}`,
  );
}

async function schedulePayoutsForOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  actorUserId: string;
}): Promise<void> {
  const { admin, orderId, actorUserId } = args;

  // Pull the order + linked vendor + linked event date in one round-trip.
  const { data: orderRow } = await admin
    .from('orders')
    .select(
      `order_id, vendor_profile_id, confirmed_total_php, requested_total_php,
       setnayan_fee_bps, gateway_fee_centavos, payment_method_key, event_id,
       service_key,
       vendor:vendor_profiles!orders_vendor_profile_id_fkey(public_visibility),
       event:events!orders_event_id_fkey(event_date)`,
    )
    .eq('order_id', orderId)
    .maybeSingle();

  if (!orderRow) return;
  const row = orderRow as unknown as {
    order_id: string;
    vendor_profile_id: string | null;
    confirmed_total_php: number | null;
    requested_total_php: number;
    setnayan_fee_bps: number | null;
    gateway_fee_centavos: number | null;
    payment_method_key: string | null;
    event_id: string | null;
    service_key: string | null;
    vendor: { public_visibility: string | null } | null;
    event: { event_date: string | null } | null;
  };

  // Skip non-vendor orders silently — couples buying Setnayan SKUs don't
  // generate a vendor payout schedule.
  if (!row.vendor_profile_id) return;

  // MONEY-DIRECTION GUARD (M1): a vendor payout must only ever be dispatched
  // for a COUPLE BOOKING — i.e. an order where a couple paid Setnayan for a
  // vendor's service and we owe the vendor their net. A vendor BRANCH
  // activation order (`vendor_additional_branch__{id}`, owner-locked
  // 2026-06-05) runs the OTHER direction: the VENDOR pays Setnayan ₱999 for an
  // Enterprise sub-location. Those orders carry `vendor_profile_id` (the paying
  // vendor) but NO `event_id` (there's no wedding behind them), so the old
  // `if (!row.vendor_profile_id) return;` guard let them fall through and
  // wrongly queued a vendor PAYOUT — i.e. Setnayan would pay the vendor for an
  // order the vendor was paying US for.
  //
  // Two independent signals, either of which means "not a couple booking":
  //   1. No linked event   → couple bookings always carry an event_id.
  //   2. A branch service_key → the vendor-pays-Setnayan direction explicitly.
  // The event_id check alone is robust; the service_key check is belt-and-
  // suspenders for any other vendor-pays-Setnayan SKU that joins this code path.
  const isBranchOrder =
    !!row.service_key && branchIdFromServiceKey(row.service_key) !== null;
  if (!row.event_id || isBranchOrder) return;

  const basePhp = Number(row.confirmed_total_php ?? row.requested_total_php ?? 0);
  if (basePhp <= 0) return;

  // Gross = pre-VAT base + 12% VAT (the customer pays gross).
  const { gross } = computeVatFromBase(basePhp, await getEffectiveVatRatePct(admin));
  const grossCentavos = phpToCentavos(gross);

  // Effective convenience-fee bps: a per-order snapshot wins (orders.setnayan_fee_bps,
  // captured at checkout) so historical orders keep their original fee; otherwise
  // use the admin-set platform fee from platform_settings, which itself falls back
  // to the 5.0% code constant when unset (= unchanged behavior pre-migration).
  const effectiveFeeBps =
    row.setnayan_fee_bps ?? (await getSetnayanFeeBps(admin));

  const breakdown = computePayoutBreakdown({
    grossCentavos,
    setnayanFeeBps: effectiveFeeBps,
    gatewayFeeCentavos: row.gateway_fee_centavos ?? undefined,
  });

  // Write the breakdown back onto the order row so receipts / vendor surfaces
  // can read it without re-computing.
  await admin
    .from('orders')
    .update({
      gateway_fee_centavos: breakdown.gatewayFeeCentavos,
      bir_withholding_centavos: breakdown.birWithholdingCentavos,
      vendor_net_centavos: breakdown.vendorNetCentavos,
      disbursement_fee_centavos: breakdown.disbursementFeeCentavos,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  const verificationState = resolveVendorVerificationState({
    public_visibility: row.vendor?.public_visibility ?? null,
  });

  await dispatchVendorPayouts(admin, {
    orderId,
    vendorProfileId: row.vendor_profile_id,
    verificationState,
    paidAt: new Date().toISOString(),
    eventDate: row.event?.event_date ?? null,
    breakdown,
    // Default disbursement rail until the vendor sets a preferred one in
    // their profile (V1.5 field). `maya_account` maps to the spec's
    // 'maya' rail in the legacy `payout_method` CHECK column on
    // vendor_payouts (migration 20260516020000).
    payoutMethod: 'maya_account',
    actorUserId,
  });
}

async function issueReceiptForOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
}): Promise<void> {
  const { admin, orderId } = args;

  // Skip if a receipt was already issued for this order.
  const { data: existing } = await admin
    .from('receipts')
    .select('receipt_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return;

  const { data: order } = await admin
    .from('orders')
    .select('user_id, service_key, confirmed_total_php, requested_total_php, voucher_discount_centavos')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!order) return;

  // For customer SKUs the order's *_total_php fields are the **pre-VAT base**
  // (the value Setnayan quotes); VAT is added on top, so the buyer paid
  // base + 12%. For vendor charm prices the stored total is ALREADY the
  // all-in gross (VAT baked in) — see isVatInclusiveServiceKey.
  //
  // #3 (money bug-hunt 2026-06-26): a BIR Official Receipt must reflect the
  // amount actually paid. `requested_total_php` is the PRE-voucher base, so a
  // voucher-discounted order whose `confirmed_total_php` is still NULL was
  // getting a receipt overstating the pre-VAT/VAT/gross. Mirror `orderGrossOwed`:
  // net the voucher discount off the requested base when not yet confirmed.
  const voucherDiscountPhp = Number(order.voucher_discount_centavos ?? 0) / 100;
  const storedTotal =
    order.confirmed_total_php != null
      ? Number(order.confirmed_total_php)
      : Math.max(0, Number(order.requested_total_php ?? 0) - voucherDiscountPhp);
  if (storedTotal <= 0) return;

  // The buyer, when there is one. A GUEST order (owner-locked 2026-07-29) has
  // `user_id` NULL — nobody to look up — so the receipt is issued to whatever
  // name the payer typed on the payment form, falling back to
  // "Guest of <event>".
  //
  // ⚠ BIR: an anonymous Official Receipt is FLAGGED FOR THE ACCOUNTANT, not
  // blocked. The transaction happened, the money is real, and a receipt that
  // refuses to exist because the payer had no account is worse for the audit
  // trail than one that says who we honestly know them to be. (Standing
  // interim-payments default: document, don't block.)
  const { data: buyer } = order.user_id
    ? await admin
        .from('users')
        .select('email, display_name')
        .eq('user_id', order.user_id)
        .maybeSingle()
    : { data: null };

  let guestReceiptFallback: string | null = null;
  if (!order.user_id) {
    // `events.display_name`, NOT `event_name` — the latter does not exist on the
    // table, and a query naming a phantom column returns an error that a
    // `?? null` would quietly render as "no event". (Phantom-column class: 26
    // live bugs, same shape.)
    const { data: guestRow } = await admin
      .from('papic_guest_orders')
      .select('payer_name, event:events(display_name)')
      .eq('order_id', orderId)
      .maybeSingle();
    guestReceiptFallback = guestReceiptName(
      (guestRow as { payer_name?: string | null } | null)?.payer_name ?? null,
      ((guestRow as { event?: { display_name?: string | null } | null } | null)?.event
        ?.display_name as string | null) ?? null,
    );
  }

  // VAT-inclusive vendor orders: back the VAT OUT of the gross so the receipt's
  // pre_vat + vat sum to the ₱999 actually paid (not ₱999 + ₱119.88). Customer
  // orders: build VAT UP from the pre-VAT base, unchanged.
  const { preVat, vat, gross } = isVatInclusiveServiceKey(order.service_key)
    ? computeVatFromGross(storedTotal)
    : computeVatFromBase(storedTotal, await getEffectiveVatRatePct(admin));

  // or_serial defaults from public.or_serial_seq (atomic) — don't pass it.
  // The display "Transaction No." is composed at read-time via formatReceiptNumber().
  await admin.from('receipts').insert({
    order_id: orderId,
    user_id: order.user_id ?? null,
    issued_to_email: buyer?.email ?? 'unknown@setnayan.com',
    issued_to_name: buyer?.display_name ?? guestReceiptFallback,
    pre_vat_php: preVat,
    vat_amount_php: vat,
    gross_total_php: gross,
  });
}

export async function rejectPayment(formData: FormData) {
  const { userId } = await requireAdmin();
  const paymentId = formData.get('payment_id');
  const adminNotes = nullIfBlank(formData.get('admin_notes'));
  if (typeof paymentId !== 'string') throw new Error('Invalid input');

  const admin = createAdminClient();
  // State-machine guard (Task 8 pilot hardening, 2026-06-01): only flip
  // pending → rejected. Mirrors approvePayment guard — if another admin
  // already approved or rejected this payment, the WHERE filter zeros the
  // update and we surface "already resolved" rather than overwriting a
  // matched payment + double-notifying the customer.
  const { data: payment, error } = await admin
    .from('payments')
    .update({
      status: 'rejected',
      admin_notes: adminNotes,
      reviewed_by_user_id: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId)
    .eq('status', 'pending')
    .select('order_id, user_id, amount_php')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!payment) {
    const { data: existing } = await admin
      .from('payments')
      .select('status')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (!existing) throw new Error('Payment not found');
    throw new Error(
      `Payment already resolved (status: ${existing.status}). Refresh the page.`,
    );
  }

  const { data: order } = await admin
    .from('orders')
    .select('event_id, status, service_key')
    .eq('order_id', payment.order_id)
    .maybeSingle();

  // PR4 dead-unlock repair (2026-06-15): a permanent rejection must REVOKE
  // access. checkOrderOwnership() treats any order whose status is NOT in
  // {cancelled, refunded, lapsed} as OWNED — so leaving the order at
  // 'submitted' after rejecting its only payment let the couple keep the
  // unlocked SKU ("pay nothing, keep everything"). Move the order out of the
  // owned set by flipping it to 'cancelled'. This is the HARD-reject path; the
  // separate requestPaymentResubmit() action keeps the order alive on purpose
  // (the couple re-uploads against the same order_id), so it must NOT cancel.
  //
  // Only flip orders that are still in a pre-fulfillment, non-terminal state —
  // never stomp a 'paid'/'fulfilled' order (e.g. a later payment already
  // settled it) or one already 'cancelled'/'refunded'/'lapsed'. The .in()
  // WHERE makes this idempotent + race-safe.
  const { data: cancelledOrder, error: cancelErr } = await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', payment.order_id)
    .in('status', ['draft', 'submitted', 'awaiting_payment'])
    .select('order_id')
    .maybeSingle();
  if (cancelErr) {
    // Non-fatal: the payment is already rejected + the couple is notified
    // below. A failed cancel leaves a recoverable state (admin re-runs /
    // flips the row manually) rather than blocking the rejection. Log it so
    // the order-status drift is visible.
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Reject payment — cancel order to revoke access',
      file_path: 'app/admin/payments/actions.ts',
      error_message: cancelErr.message,
      payload_snapshot: { paymentId, orderId: payment.order_id, priorStatus: order?.status ?? null },
    });
  }

  // If the reject actually cancelled the order, revoke any flag-backed
  // entitlement it granted (today: SETNAYAN_AI). deactivateOrderSku re-derives
  // ownership from the post-cancel state and clears events.setnayan_ai_active
  // iff the event no longer owns AI by any other live order/bundle — symmetric
  // to refundOrder. (In practice reject only cancels pre-paid orders, which
  // never stamped the flag, so this is defensive symmetry; the re-derive makes
  // it safe either way — it never clears a flag the couple still owns.)
  if (cancelledOrder) {
    await deactivateOrderSku({
      admin,
      orderId: payment.order_id,
      eventId: order?.event_id ?? null,
      serviceKey: order?.service_key ?? '',
      actorUserId: userId,
    });
  }

  // Day 3 voucher sprint: ledger write for the payment_rejected transition.
  // Snapshot the rejected amount + admin reasoning.
  await appendLedger(admin, {
    order_id: payment.order_id,
    event_type: 'payment_rejected',
    actor_user_id: userId,
    actor_role: 'admin',
    amount_centavos: Math.round(Number(payment.amount_php) * 100),
    payment_id: paymentId,
    metadata: {
      admin_notes: adminNotes,
      // Record whether the reject also cancelled the order (it's a no-op when
      // the order had already settled to paid/fulfilled by another payment).
      order_cancelled: Boolean(cancelledOrder),
      prior_order_status: order?.status ?? null,
    },
  });

  await notifyBuyerIfAny(payment.user_id, {
    type: 'payment_rejected',
    title: `Payment of ${formatPhp(payment.amount_php)} couldn't be matched`,
    body: adminNotes ?? 'Please review and try again, or reach out to support.',
    relatedUrl: order?.event_id
      ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
      : null,
  });

  revalidatePath('/admin/payments');
  // PR4: the reject may have cancelled the order (revoking a SKU), so force the
  // couple's gated surfaces to re-render locked — mirrors the layout-level
  // revalidate approvePayment + refundOrder use for the access flip.
  revalidatePath('/dashboard', 'layout');
}

// ============================================================================
// requestPaymentResubmit — 3rd state of the admin payment review action
// ============================================================================
//
// Day 3 of the voucher + inline-checkout sprint (CLAUDE.md 2026-05-29 Day 3
// row · sprint brief at VOUCHER_SPRINT_BRIEF.md). The previous Approve /
// Reject binary forces admins into a hard rejection for payments that just
// need a clearer screenshot or a corrected reference code. This adds a
// middle path: "Request resubmit" leaves the payment in a labeled state +
// emails the couple with a brand-voice notice so they upload again without
// having to start over.
//
// Behavior:
//   1. Authorize: actor must be admin/internal/team_member (requireAdmin).
//   2. Validate: payment_id is a string, admin_resubmit_notice is a non-
//      blank string with ≥ 10 chars (so admins can't fire blank notices
//      that leave the couple guessing what went wrong).
//   3. State-machine guard: only flip pending → resubmit_requested. If the
//      payment was already approved/rejected by a parallel admin, the
//      WHERE clause zeros the update + we surface "already resolved" —
//      same idempotent pattern approvePayment + rejectPayment use.
//   4. Stamp payments.admin_resubmit_notice + reviewed_by_user_id +
//      reviewed_at (analogous to the approve/reject paths).
//   5. order_ledger 'payment_resubmit_requested' write (best-effort).
//   6. emitNotification with type='payment_resubmit_requested' (newly
//      added enum value via migration 20260529030000) — auto-fires both
//      the in-app notification row AND a Resend email per
//      lib/notification-emit.ts.
//   7. revalidatePath('/admin/payments') so the admin's queue refreshes.
//
// Schema state on prod (post-migration 20260529010000_voucher_system_day1):
//   • payment_status enum includes 'resubmit_requested'
//   • payments.admin_resubmit_notice TEXT column exists
//   • order_ledger event_type CHECK includes 'payment_resubmit_requested'
//     (from 20260529020000 line 179)
//   • notification_type enum includes 'payment_resubmit_requested' as of
//     migration 20260529030000_voucher_system_day3_admin_resubmit.sql
//
// Couple recovery path: the order detail page renders the resubmit notice
// in an amber banner + re-opens the upload form whenever payments.status =
// 'resubmit_requested'. See apps/web/app/dashboard/[eventId]/orders/
// [orderId]/page.tsx (Day 3 wiring).
//
// Single-admin authority for V1 — no two-admin gate. The action is
// reversible (admin can flip to approved or rejected on the resubmission)
// so the four-eyes lock from 0023 § 9.1 (two-admin for high-stakes
// irreversible actions) doesn't apply.
// ============================================================================

export async function requestPaymentResubmit(formData: FormData) {
  const { userId } = await requireAdmin();
  const paymentId = formData.get('payment_id');
  const noticeRaw = formData.get('admin_resubmit_notice');
  if (typeof paymentId !== 'string') throw new Error('Invalid input');

  // Resubmit notice is REQUIRED — the couple needs to know what was wrong
  // so they can fix it before re-uploading. A blank notice would be worse
  // than a hard rejection (at least rejection has a clear next-action:
  // contact support). Enforce server-side too · the admin form already
  // has minLength=10 client-side but a hand-rolled POST could slip past.
  if (typeof noticeRaw !== 'string') {
    throw new Error('Resubmit notice is required.');
  }
  const notice = noticeRaw.trim();
  if (notice.length < 10) {
    throw new Error(
      'Resubmit notice needs at least 10 characters so the couple knows what to fix.',
    );
  }
  if (notice.length > 2000) {
    throw new Error('Resubmit notice is too long — please keep it under 2000 characters.');
  }

  const admin = createAdminClient();

  // State-machine guard: only flip pending → resubmit_requested. Mirrors the
  // race-guard pattern from approvePayment + rejectPayment above. If the
  // payment is already matched/rejected/resubmit_requested by a parallel
  // admin (race · double-click · stale page), surface "already resolved"
  // instead of overwriting.
  const { data: payment, error: pErr } = await admin
    .from('payments')
    .update({
      status: 'resubmit_requested',
      admin_resubmit_notice: notice,
      reviewed_by_user_id: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId)
    .eq('status', 'pending')
    .select('order_id, user_id, amount_php')
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!payment) {
    const { data: existing } = await admin
      .from('payments')
      .select('status')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (!existing) throw new Error('Payment not found');
    throw new Error(
      `Payment already resolved (status: ${existing.status}). Refresh the page.`,
    );
  }

  // Look up the order so the couple's email + in-app notification can deep-
  // link directly to the order detail page where they re-upload.
  const { data: order } = await admin
    .from('orders')
    .select('event_id, public_id')
    .eq('order_id', payment.order_id)
    .maybeSingle();

  // Day 3 voucher sprint: ledger write for the payment_resubmit_requested
  // transition. Snapshot the admin's reasoning in the metadata.
  await appendLedger(admin, {
    order_id: payment.order_id,
    event_type: 'payment_resubmit_requested',
    actor_user_id: userId,
    actor_role: 'admin',
    amount_centavos: Math.round(Number(payment.amount_php) * 100),
    payment_id: paymentId,
    metadata: { admin_resubmit_notice: notice },
  });

  // emitNotification auto-fires both the in-app row AND a Resend email when
  // RESEND_API_KEY is configured (lib/notification-emit.ts:46). The email
  // body is composed from the title + body + relatedUrl — brand-voice copy
  // here surfaces verbatim to the couple's inbox.
  await notifyBuyerIfAny(payment.user_id, {
    type: 'payment_resubmit_requested',
    title: `Please re-upload your payment for order ${order?.public_id ?? ''}`.trim(),
    // The admin's notice IS the body — they know what the couple needs to
    // fix. We don't editorialize · we pass it through verbatim.
    body: notice,
    relatedUrl: order?.event_id
      ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
      : null,
  });

  revalidatePath('/admin/payments');
}

// ============================================================================
// refundOrder — record an external bank-transfer reversal against a paid order
// ============================================================================
//
// WHY (CLAUDE.md 2026-05-23 row "Refund action on /admin/payments"):
// Pilot launches ~2026-06-01 with 5-20 personal/family cohort exercising real
// BDO/GCash payments. Manual reconciliation makes duplicate transfers common
// (couple sends GCash, doesn't see confirmation, resends). Today's only
// recovery path is Supabase Studio under live customer pressure. This action
// records the refund + notifies the couple in a single in-app step.
//
// Behavior:
//   1. Authorize: actor must be admin/internal/team_member.
//   2. Validate input: order_id is a string, reason ≥ 20 chars, amount > 0
//      and ≤ a sanity ceiling (same ₱100M ceiling confirmOrderTotal uses
//      below — refunds inherit the same paste-typo guard).
//   3. Idempotent guard: the orders.update flips status only when the
//      current row is in ('paid', 'fulfilled'). If the row is already
//      'refunded' (concurrent admin, double-click, stale page), the WHERE
//      clause returns zero rows and we surface a clean no-op message.
//   4. Insert order_refunds (UNIQUE on order_id catches the race that
//      slips past the WHERE filter — a 23505 unique-violation is also
//      surfaced as "already refunded").
//   5. admin_audit_log entry per 0023 § 2 (action='refund_order' + before/
//      after JSON in metadata).
//   6. emitNotification with type='payment_refunded' (newly registered in
//      lib/notifications.ts + the notification_type enum via the same
//      20260607060000 migration).
//   7. Revalidate /admin/payments + the couple's order detail layout.
//
// Setnayan does NOT auto-credit money back; refunds happen off-platform via
// reverse bank transfer. This action just records the truth.
//
// Two-admin gate per 0023 § 9.1 (refunds > ₱25K) is V1.x — this V1 action
// is single-admin authority for the pilot cohort.
// ============================================================================

export async function refundOrder(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  const orderId = formData.get('order_id');
  const reason = nullIfBlank(formData.get('reason'));
  const proofUrl = nullIfBlank(formData.get('proof_url'));
  const amountRaw = formData.get('refund_amount_php');

  if (typeof orderId !== 'string') {
    throw new Error('Refund missing order_id.');
  }
  if (!reason || reason.length < 20) {
    throw new Error(
      'Refund needs a reason (at least 20 characters) so we have a paper trail for the couple.',
    );
  }
  if (typeof amountRaw !== 'string') {
    throw new Error('Refund amount is required.');
  }
  const amountPhp = Number(amountRaw);
  if (!Number.isFinite(amountPhp) || amountPhp <= 0) {
    throw new Error('Refund amount must be a positive number.');
  }
  // Inherit the same ₱100M paste-typo guard confirmOrderTotal uses below —
  // wedding totals never approach this in practice.
  const MAX_REFUND_AMOUNT_PHP = 100_000_000;
  if (amountPhp > MAX_REFUND_AMOUNT_PHP) {
    throw new Error(
      `Refund amount ${amountPhp} exceeds the ₱${MAX_REFUND_AMOUNT_PHP.toLocaleString()} sanity ceiling — double-check the input.`,
    );
  }
  const refundCentavos = Math.round(amountPhp * 100);

  const admin = createAdminClient();

  // Step 1: read current order state so the audit-log carries before-JSON +
  // we can surface useful messages when the idempotent flip is a no-op.
  const { data: orderBefore, error: readErr } = await admin
    .from('orders')
    .select(
      'order_id, user_id, event_id, public_id, status, service_key, requested_total_php, confirmed_total_php',
    )
    .eq('order_id', orderId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!orderBefore) throw new Error('Order not found.');

  // Idempotent no-op when the order is already refunded — surface a friendly
  // message rather than re-firing the notification and audit row. The same
  // path catches the case where a concurrent admin refunded a few seconds
  // ago: the read here would already show status='refunded'.
  if (orderBefore.status === 'refunded') {
    revalidatePath('/admin/payments');
    throw new Error(
      `Order ${orderBefore.public_id} is already marked refunded. Nothing to do — refresh the page.`,
    );
  }

  // Only paid / fulfilled orders can be refunded. Cancelled / draft /
  // submitted / awaiting_payment orders shouldn't surface a refund button
  // in the UI, but we guard server-side too so a hand-rolled form post
  // can't slip past.
  if (!(orderBefore.status === 'paid' || orderBefore.status === 'fulfilled')) {
    throw new Error(
      `Refund only applies to paid or fulfilled orders. This order is ${orderBefore.status} — cancel or close it instead.`,
    );
  }

  // Step 2: flip the order to refunded. Conditional WHERE guards against
  // a concurrent admin who already flipped it between the read and this
  // update (race window is small but real).
  const { data: orderAfter, error: updErr } = await admin
    .from('orders')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .in('status', ['paid', 'fulfilled'])
    .select('order_id, status')
    .maybeSingle();
  if (updErr) throw new Error(`Order refund flip failed: ${updErr.message}`);
  if (!orderAfter) {
    // The WHERE filter zeroed out — another admin or a prior call beat us.
    revalidatePath('/admin/payments');
    throw new Error(
      `Order ${orderBefore.public_id} was refunded by another admin or has moved out of paid/fulfilled. Refresh the page.`,
    );
  }

  // Revoke flag-backed entitlements (today: SETNAYAN_AI's stored
  // events.setnayan_ai_active). The order is now 'refunded' and out of the owned
  // set, so deactivateOrderSku re-derives ownership and clears the AI flag iff
  // the event no longer owns it via any other live order/bundle. Without this
  // the paid AI capability would survive a full refund ("refund the money, keep
  // the AI"). Non-fatal + idempotent; runs AFTER the flip so the re-derive sees
  // the refunded state. Orders-backed gates (monogram/QR/papic/website) re-lock
  // for free, so they need nothing here.
  await deactivateOrderSku({
    admin,
    orderId,
    eventId: orderBefore.event_id ?? null,
    serviceKey: orderBefore.service_key ?? '',
    actorUserId: adminUserId,
  });

  // Step 3: insert the order_refunds audit row. The UNIQUE(order_id) index
  // is the belt-and-suspenders idempotency guard — a 23505 unique-violation
  // here means another concurrent refund already inserted, which we surface
  // the same way as the WHERE-clause no-op above.
  const { error: refundInsertErr } = await admin.from('order_refunds').insert({
    order_id: orderId,
    refund_amount_centavos: refundCentavos,
    reason,
    refunded_by_admin_id: adminUserId,
    proof_url: proofUrl,
    status: 'sent',
  });
  if (refundInsertErr) {
    // The order row already flipped to refunded above — if we can't write
    // the audit row, the order state is inconsistent with the ledger.
    // Re-throw so the admin sees the error and the operator can decide
    // whether to roll the order back via Supabase Studio. This is a rare
    // path (UNIQUE collision on a row we just guarded against above).
    throw new Error(
      `Order ${orderBefore.public_id} status flipped to refunded but the order_refunds row failed to insert: ${refundInsertErr.message}. Check Supabase Studio + revert the order status if needed.`,
    );
  }

  // Step 4: admin_audit_log entry per 0023 § 2. Best-effort — a failed
  // audit-log insert should NOT block the refund (the order_refunds row IS
  // the load-bearing audit trail; admin_audit_log is the cross-surface
  // stream).
  try {
    await admin.from('admin_audit_log').insert({
      action: 'refund_order',
      target_id: orderId,
      actor_user_id: adminUserId,
      metadata: {
        order_public_id: orderBefore.public_id,
        before: { status: orderBefore.status },
        after: { status: 'refunded' },
        refund_amount_centavos: refundCentavos,
        refund_amount_php: amountPhp,
        reason,
        proof_url: proofUrl,
      },
    });
  } catch (auditErr) {
    console.error('[refundOrder] admin_audit_log insert failed (non-fatal):', auditErr);
  }

  // Step 5: notify the couple. Polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]] —
  // we tell them what landed, not what the database did.
  await notifyBuyerIfAny(orderBefore.user_id, {
    type: 'payment_refunded',
    title: `Refund recorded for order ${orderBefore.public_id}`,
    body:
      `Setnayan returned ${formatPhp(amountPhp)} to your bank or e-wallet. ` +
      `Reach out if you don’t see the transfer within 1–3 banking days.`,
    relatedUrl: orderBefore.event_id
      ? `/dashboard/${orderBefore.event_id}/orders/${orderId}`
      : null,
  });

  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  // Couple-side dashboard re-reads the orders row + the status pill flips
  // to "Refunded" without a hard refresh. Mirrors the layout-level
  // revalidate approvePayment uses for the activation flip above.
  revalidatePath('/dashboard', 'layout');
}

export async function confirmOrderTotal(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('order_id');
  const confirmedRaw = formData.get('confirmed_total_php');
  const adminNotes = nullIfBlank(formData.get('admin_notes'));
  if (typeof orderId !== 'string' || typeof confirmedRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const amount = Number(confirmedRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Confirmed amount must be a non-negative number');
  }
  // Sanity ceiling. ₱100M is well above any realistic wedding total
  // (the largest V1 SKU bundles are well under ₱1M) so anything
  // higher is a paste-typo, not a real number. Catching it here
  // beats baking the wrong value into orders + payouts.
  const MAX_CONFIRMED_AMOUNT_PHP = 100_000_000;
  if (amount > MAX_CONFIRMED_AMOUNT_PHP) {
    throw new Error(
      `Confirmed amount ${amount} exceeds the ₱${MAX_CONFIRMED_AMOUNT_PHP.toLocaleString()} sanity ceiling — double-check the input.`,
    );
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from('orders')
    .update({
      confirmed_total_php: Math.round(amount * 100) / 100,
      admin_notes: adminNotes,
      status: 'awaiting_payment',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .select('user_id, event_id, public_id, confirmed_total_php')
    .single();
  if (error || !order) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Confirm order total — quote and set awaiting_payment',
      file_path: 'app/admin/payments/actions.ts',
      error_message: error?.message ?? 'Could not update order',
      payload_snapshot: { orderId, amount },
    });
    throw new Error(error?.message ?? 'Could not update order');
  }

  await notifyBuyerIfAny(order.user_id, {
    type: 'order_quoted',
    title: `Order ${order.public_id} quoted at ${formatPhp(order.confirmed_total_php)}`,
    body: adminNotes ?? 'Open the order to view payment instructions.',
    relatedUrl: order.event_id
      ? `/dashboard/${order.event_id}/orders/${orderId}`
      : null,
  });

  revalidatePath('/admin/payments');
}

/**
 * Release a vendor payout that was previously placed on hold (m3).
 *
 * The hold path (`holdPayout` / `holdPayoutAction` in app/admin/payouts/)
 * could set `on_hold=true` with no admin-facing way back — a held payout was
 * stuck until someone hand-edited the DB. This action reverses it: clears
 * `on_hold` + `hold_reason` and records a `released_hold` audit entry.
 *
 * Single-admin authority is fine for V1 (same gate as mark-paid / hold; the
 * audit_log captures who released and why). The release UI button belongs next
 * to the existing Mark-paid / Place-on-hold controls in
 * app/admin/payouts/page.tsx; wiring that button is a 1-line follow-up in that
 * page (outside this unit's owned files). Until then this action is callable
 * directly and via any form posting `payout_id` (+ optional `reason`).
 */
export async function releasePayoutHoldAction(formData: FormData) {
  const { userId } = await requireAdmin();
  const payoutId = nullIfBlank(formData.get('payout_id'));
  if (!payoutId) throw new Error('Missing payout_id.');
  const reason = nullIfBlank(formData.get('reason'));

  const result = await releasePayoutHold(createAdminClient(), {
    payoutId,
    actorUserId: userId,
    reason,
  });

  if (!result.ok) {
    redirect(`/admin/payouts?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/payouts');
  revalidatePath('/vendor-dashboard/earnings');
  redirect(
    `/admin/payouts?flash=${encodeURIComponent('Payout hold released.')}`,
  );
}
