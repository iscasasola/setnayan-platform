'use server';

/**
 * Vendor Transaction Lifecycle · Phase 2 · PR-C — vendor confirms a payment.
 *
 * The couple logs an off-platform payment (with optional proof) against their
 * booking. event_vendor_payments is the COUPLE's table (couple-RLS) — a vendor
 * can't read or write it directly. So the confirm flows through the DB guard
 * confirm_vendor_payment() (SECURITY DEFINER, ownership-checked), exactly the
 * way pax-actions.ts moves a couple-owned event_vendors total only after
 * proving the vendor owns the booking.
 *
 * On success this also notifies the couple (payment_confirmed) so they see the
 * vendor acknowledged the money. Best-effort: the DB write already happened
 * inside the RPC; a failed notify must never roll it back.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Confirm a couple-logged payment was received. The DB guard
 * (confirm_vendor_payment) re-verifies the caller owns the booking, so this is
 * defense-in-depth, not the only gate. No-ops (returns) on any unauthorized /
 * missing input rather than throwing — the card just won't re-render.
 */
export async function confirmVendorPayment(formData: FormData): Promise<void> {
  const paymentId = String(formData.get('payment_id') ?? '');
  const threadId = String(formData.get('thread_id') ?? '');
  if (!paymentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return;

  // Pre-resolve the booking for the ownership gate + the post-confirm couple
  // notify. The RPC enforces ownership itself; we mirror the pax-actions gate
  // here so we never call the RPC for a booking that isn't ours and so we can
  // resolve the couple + amount for the notification.
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('event_vendor_payments')
    .select('payment_id, event_id, vendor_id, amount_php, vendor_confirmed_at')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (!pay) return;

  const { data: ev } = await admin
    .from('event_vendors')
    .select('vendor_id, marketplace_vendor_id')
    .eq('vendor_id', pay.vendor_id)
    .maybeSingle();
  // Ownership gate: the vendor may only confirm a payment on a booking of theirs.
  if (!ev || ev.marketplace_vendor_id !== profile.vendor_profile_id) return;

  // The DB guard. SECURITY DEFINER + re-checks ownership; sets only
  // vendor_confirmed_at/by; idempotent. The authed (couple-RLS) client can't
  // touch the row, but RPC EXECUTE is granted to authenticated, so call it via
  // the authed client — the function runs as definer + reads auth.uid() = us.
  const wasUnconfirmed = pay.vendor_confirmed_at == null;
  const { error } = await supabase.rpc('confirm_vendor_payment', {
    p_payment_id: paymentId,
  });
  if (error) {
    console.error('[pay-confirm] confirm_vendor_payment failed:', error.message);
    return;
  }

  // Notify the couple — only on a transition (skip if it was already confirmed,
  // so a double-tap doesn't double-notify). Best-effort.
  if (wasUnconfirmed) {
    try {
      const vendorName = profile.business_name?.trim() || 'Your vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', pay.event_id)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'payment_confirmed',
          title: `${vendorName} confirmed your payment`,
          body: `${vendorName} confirmed receiving your ₱${Number(
            pay.amount_php ?? 0,
          ).toLocaleString('en-PH')} payment.`,
          relatedUrl: `/dashboard/${pay.event_id}/vendors/${pay.vendor_id}/workspace`,
        });
      }
    } catch (e) {
      console.error('[pay-confirm] couple notify failed:', e);
    }
  }

  if (threadId) revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  revalidatePath('/vendor-dashboard/messages');
}
