'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { paymentRowFor } from '@/lib/order-mint-identity';
import { parseClientRef, orderPaymentProofPolicy } from '@/lib/r2-client-ref';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { isVendorBookingFeeServiceKey, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

/**
 * Vendor-scoped "log a payment against my booking-fee order." This is the
 * VENDOR analogue of the couple-side logPayment (app/dashboard/[eventId]/orders/
 * actions.ts) — but that one is event-scoped (guards event_id + redirects into
 * the couple dashboard the vendor can't reach), so we can't reuse it verbatim.
 *
 * SAFETY:
 *   • ownership — the target must be one of the CALLER's OWN fee orders. RLS
 *     (orders_owner_read · user_id = auth.uid()) already scopes the SELECT, and
 *     we additionally assert the service_key is a booking-fee key so this action
 *     can only ever touch fee orders.
 *   • the vendor NEVER marks the fee paid. This only INSERTs a payment row, and
 *     `paymentRowFor` (lib/order-mint-identity.ts) STAMPS status='pending' and
 *     forbids the call site from passing one. That is what pins the status
 *     post-SEC-4b — NOT the DB write-guard: payments_insert_status_guard
 *     (20270920010000) is RESTRICTIVE `TO authenticated` and exempts
 *     service_role, which is the role this insert now runs as. Promotion to
 *     paid stays the admin-only /admin/payments approve path (approvePaymentCore
 *     → activateOrderSku → the booking-fee settle bridge). So logging proof here
 *     speeds reconciliation but grants the vendor no self-approval.
 */
function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function logBookingFeePayment(formData: FormData) {
  const orderId = formData.get('order_id');
  const amountRaw = formData.get('amount_php');
  const channel = formData.get('channel');
  const paidAtRaw = formData.get('paid_at');

  if (typeof orderId !== 'string' || typeof channel !== 'string') {
    throw new Error('Invalid input');
  }
  if (typeof amountRaw !== 'string') throw new Error('Amount required');
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be > 0');
  const trimmedChannel = channel.trim();
  if (trimmedChannel.length === 0) throw new Error('Channel required');

  const paidAt =
    typeof paidAtRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw)
      ? paidAtRaw
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ownership + fee-order guard. RLS scopes this read to the caller's own
  // orders; the service_key assertion keeps this action fee-only. A foreign or
  // non-fee order_id resolves to a reject.
  const { data: order } = await supabase
    .from('orders')
    .select('order_id,user_id,service_key,status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (
    !order ||
    (order as { user_id?: string }).user_id !== user.id ||
    !isVendorBookingFeeServiceKey((order as { service_key?: string | null }).service_key)
  ) {
    throw new Error('Booking-fee order not found');
  }

  // Optional screenshot proof — direct-to-R2 ref (r2://…) from <FileUpload>.
  let screenshotUrl: string | null = null;
  const screenshotRefRaw = formData.get('screenshot_ref');
  // SEC-1: `startsWith('r2://')` is NOT a check. The ref is a form field, so a
  // bare scheme test let a vendor pin ANY key in ANY bucket onto their own fee
  // row — and an admin then renders it presigned on the reconciliation screen.
  // Bind it to this order's private-bucket prefix instead.
  if (
    typeof screenshotRefRaw === 'string' &&
    parseClientRef(screenshotRefRaw.trim(), orderPaymentProofPolicy(orderId))
  ) {
    screenshotUrl = screenshotRefRaw.trim();
  }

  // Per-render idempotency (mirrors the couple logPayment): a double-submit /
  // retry ships the same UUID; the (order_id, client_idempotency_key) partial
  // unique index makes the second insert a no-op.
  const idempotencyKeyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 64)
      : null;

  // Insert the payment at status 'pending', so the vendor cannot self-approve.
  //
  // ⚠ WHAT ENFORCES THAT, POST-SEC-4b: `paymentRowFor` STAMPS `status:
  // 'pending'` and makes `status` a forbidden field, so this call site cannot
  // set one at all. It is NOT the RLS write-guard any more — this insert runs
  // as service_role (below), and `payments_insert_status_guard`
  // (20270920010000) is RESTRICTIVE `TO authenticated` whose first branch is
  // `auth.role() = 'service_role'`, so it no longer evaluates on this path. The
  // previous wording here ("the write-guard rejects anything else from a
  // non-admin") described a check that stopped running when this site moved to
  // the admin client.
  //
  // ── SEC-4b · service-role write, ownership already proven above ────────────
  // `payments` INSERT is revoked from `authenticated` (migration
  // 20271008178212), so this goes through service_role and no longer satisfies
  // `payments_owner_insert` by RLS — it bypasses it. The authorization is
  // unchanged and stays where it was: the `orders` SELECT above runs on the
  // SESSION client (RLS-scoped), AND this action already asserted
  // `order.user_id === user.id` explicitly plus `isVendorBookingFeeServiceKey`,
  // so the order is provably the caller's own fee order before we get here.
  // `paymentRowFor` re-binds the row to that proven order and to the server's
  // user id.
  //
  // Promotion to paid is untouched: it stays the admin-only /admin/payments
  // approve path (approvePaymentCore → activateOrderSku → the settle bridge).
  const { error } = await createMoneyWriterClient().from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: Math.round(amount * 100) / 100,
        channel: trimmedChannel,
        reference_number: nullIfBlank(formData.get('reference_number')),
        screenshot_url: screenshotUrl,
        paid_at: paidAt,
        client_idempotency_key: idempotencyKey,
      },
    ),
  );
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505' && idempotencyKey) {
      revalidatePath(vendorBookingFeePayPath(orderId));
      redirect(`${vendorBookingFeePayPath(orderId)}?logged=1`);
    }
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Log booking-fee payment (vendor proof submission)',
      file_path: 'app/vendor-dashboard/booking-fees/actions.ts',
      error_message: error.message,
      payload_snapshot: { orderId, userId: user.id, hasIdempotencyKey: idempotencyKey !== null },
    });
    throw new Error(error.message);
  }

  revalidatePath(vendorBookingFeePayPath(orderId));
  redirect(`${vendorBookingFeePayPath(orderId)}?logged=1`);
}
