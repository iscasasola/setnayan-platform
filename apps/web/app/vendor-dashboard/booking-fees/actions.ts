'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
 *   • the vendor NEVER marks the fee paid. This only INSERTs a payment row; the
 *     DB write-guard (payments_insert_status_guard, migration 20270920010000)
 *     forces a non-admin insert to status='pending'. Promotion to paid stays
 *     the admin-only /admin/payments approve path (approvePaymentCore →
 *     activateOrderSku → the booking-fee settle bridge). So logging proof here
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
  if (typeof screenshotRefRaw === 'string' && screenshotRefRaw.trim().startsWith('r2://')) {
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

  // Insert the payment. NO status set → defaults to 'pending' (and the
  // write-guard rejects anything else from a non-admin), so the vendor cannot
  // self-approve. user_id = auth.uid() satisfies payments_owner_insert.
  const { error } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: Math.round(amount * 100) / 100,
    channel: trimmedChannel,
    reference_number: nullIfBlank(formData.get('reference_number')),
    screenshot_url: screenshotUrl,
    paid_at: paidAt,
    client_idempotency_key: idempotencyKey,
  });
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
