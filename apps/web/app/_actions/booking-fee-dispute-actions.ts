'use server';

/**
 * 🕵️ BOOKING-FEE DISPUTES — ONE server action, two doors (DECISION_LOG 2026-07-27 grace-first ladder; owner
 * 2026-11-05 "build dispute"). One dispatcher instead of two exports: every exported "use server" function is one
 * Vercel route, and the budget is tight (`scripts/lint-server-action-budget.mjs`).
 *
 *   op=open   — a supplier disputes one of their own booking-fee bills (`booking_fee_open_dispute`). Their first
 *               dispute ever is accepted on the spot (fee waived, bill voided); later ones wait for an admin, who is
 *               told in the app (`fee_dispute_opened`).
 *   op=decide — an admin accepts (fee waived, bill voided) or rejects (bill stands) a dispute under review
 *               (`booking_fee_decide_dispute`). The supplier is told in the app (`fee_dispute_answered`).
 *
 * Each branch proves its caller first — the supplier's bill is read on THEIR OWN session (RLS) and must be theirs and a
 * booking-fee bill; the admin passes `requireAdmin` — and each database step re-checks it. In-app only, never email.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
import { fetchOrderById } from '@/lib/orders';
import { BOOKING_FEE_LOCK_SERVICE_PREFIX, chargeIdFromBookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { VENDOR_BOOKING_FEES_PATH, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import {
  DISPUTE_TEXT_MAX,
  disputeAnsweredNotice,
  disputeOpenedAdminNotice,
  readOpenDisputeAnswer,
} from '@/lib/booking-fee-dispute';
import { emitAdminNotice, emitNotification } from '@/lib/notification-emit';

const words = (raw: FormDataEntryValue | null): string | null => {
  const t = typeof raw === 'string' ? raw.trim().slice(0, DISPUTE_TEXT_MAX) : '';
  return t.length > 0 ? t : null;
};

export async function bookingFeeDispute(formData: FormData): Promise<void> {
  if (formData.get('op') === 'decide') return decide(formData);
  return open(formData);
}

/** A supplier disputes one of their own booking-fee bills. */
async function open(formData: FormData): Promise<void> {
  const orderId = String(formData.get('order_id') ?? '');
  const back = vendorBookingFeePayPath(orderId);

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(back));

  const supabase = await createClient();
  const order = await fetchOrderById(supabase, orderId);
  const chargeId = order ? chargeIdFromBookingFeeLockServiceKey(order.service_key) : null;
  if (!order || order.user_id !== user.id || !chargeId) redirect(VENDOR_BOOKING_FEES_PATH);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('booking_fee_open_dispute', {
    p_charge_id: chargeId,
    p_user_id: user.id,
    p_reason: words(formData.get('reason')),
  });
  if (error) {
    console.error('[supabase-error] booking-fee-dispute · booking_fee_open_dispute', error.message, { orderId });
  }
  const answer = error ? { kind: 'error' as const } : readOpenDisputeAnswer(data);

  // A dispute that waits for review tells every admin — in the app, never by email.
  if (answer.kind === 'under_review') {
    try {
      const [{ data: charge }, { data: admins }] = await Promise.all([
        admin.from('booking_fee_charges').select('vendor_profiles(business_name)').eq('charge_id', chargeId).maybeSingle(),
        admin.from('users').select('user_id').eq('account_type', 'admin'),
      ]);
      const shop = (charge as { vendor_profiles?: { business_name?: string | null } | null } | null)?.vendor_profiles;
      const notice = disputeOpenedAdminNotice(shop?.business_name ?? null);
      await Promise.all(
        ((admins ?? []) as { user_id: string }[]).map((a) =>
          emitAdminNotice({ userId: a.user_id, type: 'fee_dispute_opened', ...notice }),
        ),
      );
    } catch (e) {
      console.error('[booking-fee-dispute] admin notice failed:', e);
    }
  }

  revalidatePath(VENDOR_BOOKING_FEES_PATH, 'layout');
  redirect(`${back}?dispute=${answer.kind}`);
}

/** An admin accepts or rejects a dispute under review. */
async function decide(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const disputeId = String(formData.get('dispute_id') ?? '');
  const accept = formData.get('decision') === 'accept';

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('booking_fee_decide_dispute', {
    p_dispute_id: disputeId,
    p_admin_id: userId,
    p_accept: accept,
    p_note: words(formData.get('note')),
  });
  if (error) {
    console.error('[supabase-error] booking-fee-dispute · booking_fee_decide_dispute', error.message, { disputeId });
    redirect('/admin/disputes?fee_dispute=error#fee-disputes');
  }
  const res = (data ?? {}) as { result?: string; vendor_profile_id?: string; charge_id?: string };

  if ((res.result === 'accepted' || res.result === 'rejected') && res.vendor_profile_id && res.charge_id) {
    try {
      const [{ data: vp }, { data: order }] = await Promise.all([
        admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', res.vendor_profile_id).maybeSingle(),
        admin.from('orders').select('order_id').eq('service_key', `${BOOKING_FEE_LOCK_SERVICE_PREFIX}${res.charge_id}`).maybeSingle(),
      ]);
      const supplier = (vp as { user_id?: string | null } | null)?.user_id ?? null;
      const orderId = (order as { order_id?: string } | null)?.order_id ?? null;
      if (supplier) {
        const notice = disputeAnsweredNotice({
          accepted: res.result === 'accepted',
          orderPath: orderId ? vendorBookingFeePayPath(orderId) : VENDOR_BOOKING_FEES_PATH,
        });
        await emitNotification({ userId: supplier, type: 'fee_dispute_answered', ...notice });
      }
    } catch (e) {
      console.error('[booking-fee-dispute] supplier answer notice failed:', e);
    }
  }

  revalidatePath('/admin/disputes');
  redirect(`/admin/disputes?fee_dispute=${encodeURIComponent(res.result ?? 'error')}#fee-disputes`);
}
