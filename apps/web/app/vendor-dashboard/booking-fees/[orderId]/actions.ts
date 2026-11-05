'use server';

/**
 * 🕵️ A SUPPLIER DISPUTES ONE BOOKING FEE (DECISION_LOG 2026-07-27 grace-first ladder; owner 2026-11-05 "build
 * dispute"). The decision lives in ONE database step, `booking_fee_open_dispute` (migration 20271310612526):
 * their first dispute ever is accepted on the spot (fee waived, bill voided); later ones wait for an admin.
 *
 * The bill is read on the supplier's OWN session first — RLS scopes `orders` to the caller, and the page's own three
 * checks are repeated (theirs · a booking-fee bill) — so a stranger's order id reads nothing and disputes nothing.
 * The step runs with the service role and checks again that the caller owns the shop the bill belongs to.
 *
 * In-app only: a dispute that waits tells the admins with `fee_dispute_opened`, never an email.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchOrderById } from '@/lib/orders';
import { chargeIdFromBookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { VENDOR_BOOKING_FEES_PATH, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { DISPUTE_TEXT_MAX, disputeOpenedAdminNotice, readOpenDisputeAnswer } from '@/lib/booking-fee-dispute';
import { emitNotification } from '@/lib/notification-emit';

export async function disputeBookingFee(formData: FormData): Promise<void> {
  const orderId = String(formData.get('order_id') ?? '');
  const raw = formData.get('reason');
  const reason = typeof raw === 'string' ? raw.trim().slice(0, DISPUTE_TEXT_MAX) : '';
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
    p_reason: reason || null,
  });
  if (error) {
    console.error('[supabase-error] vendor-dashboard/booking-fees · booking_fee_open_dispute', error.message, { orderId });
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
          emitNotification({ userId: a.user_id, type: 'fee_dispute_opened', ...notice }),
        ),
      );
    } catch (e) {
      console.error('[booking-fee-dispute] admin notice failed:', e);
    }
  }

  revalidatePath(VENDOR_BOOKING_FEES_PATH, 'layout');
  redirect(`${back}?dispute=${answer.kind}`);
}
