'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { formatPhp } from '@/lib/orders';
import { computeVatBreakdown } from '@/lib/receipts';

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

  // Look up the order so the notification can link directly + name the order.
  const { data: order } = await admin
    .from('orders')
    .select('event_id, public_id')
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
    await admin
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('order_id', payment.order_id);

    await emitNotification({
      userId: payment.user_id,
      type: 'order_paid',
      title: `Order ${order?.public_id ?? ''} marked paid`,
      body: 'Your order is fully paid. We&apos;ll start work right away.',
      relatedUrl: order?.event_id
        ? `/dashboard/${order.event_id}/orders/${payment.order_id}`
        : null,
    });

    // Auto-issue an Official Receipt (BIR § 113 compliance) — one per order.
    // The unique constraint on receipts.order_id makes the insert idempotent
    // across retries; subsequent runs silently no-op.
    await issueReceiptForOrder({ admin, orderId: payment.order_id });
  }

  revalidatePath('/admin/payments');
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

  const gross = Number(order.confirmed_total_php ?? order.requested_total_php ?? 0);
  if (gross <= 0) return;

  const { data: buyer } = await admin
    .from('users')
    .select('email, display_name')
    .eq('user_id', order.user_id)
    .maybeSingle();

  const { preVat, vat } = computeVatBreakdown(gross);

  // or_serial defaults from public.or_serial_seq (atomic) — don't pass it.
  // The display "OR number" is composed at read-time via formatOrNumber().
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
