'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { formatPhp } from '@/lib/orders';
import { computeVatFromBase } from '@/lib/receipts';
import { captureEvent } from '@/lib/analytics';
import {
  computePayoutBreakdown,
  dispatchVendorPayouts,
  getSetnayanFeeBps,
  phpToCentavos,
  resolveVendorVerificationState,
} from '@/lib/payouts';
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

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function approvePayment(formData: FormData) {
  const { userId } = await requireAdmin();
  const paymentId = formData.get('payment_id');
  const adminNotes = nullIfBlank(formData.get('admin_notes'));
  const promoteOrder = formData.get('promote_order') === 'on';
  if (typeof paymentId !== 'string') throw new Error('Invalid input');

  const admin = createAdminClient();
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
    .select('event_id, public_id, service_key')
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

  await emitNotification({
    userId: payment.user_id,
    type: 'payment_matched',
    title: `Payment of ${formatPhp(payment.amount_php)} matched`,
    body: adminNotes ?? 'The Setnayan team confirmed your payment.',
    relatedUrl: order?.event_id
      ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
      : null,
  });

  if (promoteOrder) {
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

    await emitNotification({
      userId: payment.user_id,
      type: 'order_paid',
      title: `Order ${order?.public_id ?? ''} marked paid`,
      body: 'Your order is fully paid. We&apos;ll start work right away.',
      relatedUrl: order?.event_id
        ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
        : null,
    });

    // Funnel event — fires the moment an order's status flips to paid.
    // Distinct id is the buyer's Supabase user_id (payment.user_id), so it
    // joins with `signup_completed` / `event_created` for the same person.
    // `sku_key` maps to the order's `service_key` column (closest existing
    // analog; no schema change per the wiring scope).
    try {
      await captureEvent({
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

  // Per-SKU activation dispatcher (PR3 hardening; PR4 dead-unlock repair
  // 2026-06-15: moved OUT of the `if (promoteOrder)` block so it runs on EVERY
  // approval). WHY: ownership reads off orders.status via checkOrderOwnership(),
  // which already counts a 'submitted' order as OWNED — so the moment a payment
  // is matched the capability is owned, whether or not the admin ticked
  // "promote to paid". Previously activation lived inside the promote block, so
  // approving WITHOUT promote matched the payment but never ran the side-effect
  // provisioning (SETNAYAN_AI boolean, concierge state machine, vendor branch
  // flag), leaving the capability owned-but-unprovisioned. Running it
  // unconditionally aligns provisioning with ownership.
  //
  // Some SKUs need a side effect to unlock the capability; MOST are pure no-ops
  // (ownership alone suffices). Non-fatal by contract — activateOrderSku never
  // throws, so a failed activation leaves a recoverable state (admin re-runs /
  // flips the row manually) but never rolls back the already-approved payment.
  // Hooks are idempotent, so the promote-on path (which falls through to here
  // exactly once) and a later re-approval are both safe. PR4 registers
  // PAPIC_SEATS by editing lib/sku-activation.ts, NOT this block.
  if (order) {
    await activateOrderSku({
      admin,
      orderId: payment.order_id,
      eventId: order.event_id ?? null,
      serviceKey: order.service_key ?? '',
      actorUserId: userId,
    });
  }

  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  // Force a refresh of the couple's user-facing routes so any
  // activation-reading UI (Setnayan AI banner, add-on pages) picks up the
  // status change immediately. Full activation-cycle UI fix is queued as
  // PR B (proper per-SKU activation dispatcher); for now this at least
  // makes the couple's dashboard re-render fresh data after admin approves.
  // (Brand-layer note 2026-05-28 V2 cutover — historical reference to the
  // "Concierge banner" tracks the same surface; banner copy now reads
  // "Setnayan AI".)
  revalidatePath('/dashboard', 'layout');
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
    vendor: { public_visibility: string | null } | null;
    event: { event_date: string | null } | null;
  };

  // Skip non-vendor orders silently — couples buying Setnayan SKUs don't
  // generate a vendor payout schedule.
  if (!row.vendor_profile_id) return;

  const basePhp = Number(row.confirmed_total_php ?? row.requested_total_php ?? 0);
  if (basePhp <= 0) return;

  // Gross = pre-VAT base + 12% VAT (the customer pays gross).
  const { gross } = computeVatFromBase(basePhp);
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
    .select('user_id, confirmed_total_php, requested_total_php')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!order) return;

  // The order's *_total_php fields are the **pre-VAT base** (the value Setnayan
  // quotes). VAT is added on top: customer paid (base + 12%).
  const base = Number(order.confirmed_total_php ?? order.requested_total_php ?? 0);
  if (base <= 0) return;

  const { data: buyer } = await admin
    .from('users')
    .select('email, display_name')
    .eq('user_id', order.user_id)
    .maybeSingle();

  const { preVat, vat, gross } = computeVatFromBase(base);

  // or_serial defaults from public.or_serial_seq (atomic) — don't pass it.
  // The display "Transaction No." is composed at read-time via formatReceiptNumber().
  await admin.from('receipts').insert({
    order_id: orderId,
    user_id: order.user_id,
    issued_to_email: buyer?.email ?? 'unknown@setnayan.com',
    issued_to_name: buyer?.display_name ?? null,
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

  await emitNotification({
    userId: payment.user_id,
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
  await emitNotification({
    userId: payment.user_id,
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
  await emitNotification({
    userId: orderBefore.user_id,
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

  await emitNotification({
    userId: order.user_id,
    type: 'order_quoted',
    title: `Order ${order.public_id} quoted at ${formatPhp(order.confirmed_total_php)}`,
    body: adminNotes ?? 'Open the order to view payment instructions.',
    relatedUrl: order.event_id
      ? `/dashboard/${order.event_id}/orders/${orderId}`
      : null,
  });

  revalidatePath('/admin/payments');
}
