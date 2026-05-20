'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { formatPhp } from '@/lib/orders';
import { computeVatFromBase } from '@/lib/receipts';
import { captureEvent } from '@/lib/analytics';
import {
  computePayoutBreakdown,
  dispatchVendorPayouts,
  phpToCentavos,
  resolveVendorVerificationState,
} from '@/lib/payouts';

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
    .select('order_id, user_id, amount_php')
    .single();
  if (pErr || !payment) throw new Error(pErr?.message ?? 'Could not update payment');

  // Look up the order so the notification can link directly + name the order,
  // and so the PostHog `order_paid` event below has `service_key` to slice on.
  const { data: order } = await admin
    .from('orders')
    .select('event_id, public_id, service_key')
    .eq('order_id', payment.order_id)
    .maybeSingle();

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
    // the Setnayan Pay cart flow), schedule the payout rows now. Verified
    // vendors get a single T+1 immediate stage; coming_soon / demoted get
    // the 20/60/20 staged release.
    //
    // No-op when the order isn't a vendor booking (vendor_profile_id NULL)
    // — couples buying Setnayan SKUs don't trigger vendor payouts. Failures
    // here NEVER block the payment-approval flow; payouts can be retried
    // from /admin/payouts.
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

  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  // Force a refresh of the couple's user-facing routes so any
  // activation-reading UI (Concierge banner, add-on pages) picks up the
  // status change immediately. Full activation-cycle UI fix is queued as
  // PR B (proper per-SKU activation dispatcher); for now this at least
  // makes the couple's dashboard re-render fresh data after admin approves.
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

  const breakdown = computePayoutBreakdown({
    grossCentavos,
    setnayanFeeBps: row.setnayan_fee_bps ?? undefined,
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
    .select('order_id, user_id, amount_php')
    .single();
  if (error || !payment) throw new Error(error?.message ?? 'Could not update payment');

  const { data: order } = await admin
    .from('orders')
    .select('event_id')
    .eq('order_id', payment.order_id)
    .maybeSingle();

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
  if (error || !order) throw new Error(error?.message ?? 'Could not update order');

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
