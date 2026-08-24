'use server';

/**
 * /admin/subscriptions · server actions — reconcile vendor subscription orders.
 *
 * Apply-then-pay: a vendor starts a Pro/Enterprise upgrade (pending_payment) and
 * pays our BDO / GCash receiving account with the reference code in the note.
 * Once the payment lands in the inbox, an admin confirms it here.
 *
 *   approveSubscription → approve_vendor_subscription(id) sets tier_state +
 *     tier_expires_at (stacking) + flips to 'paid'. Idempotent per purchase.
 *   rejectSubscription  → reject_vendor_subscription(id, reason).
 *
 * ⚠ THIS BLOCK USED TO CLAIM THE APPROVE PATH HANDS OUT A BUNDLE OF THE OLD
 * VENDOR CURRENCY, by calling `grant_admin_direct_tokens`. IT DOES NOT, AND
 * HAS NOT SINCE 2026-08-07 — the day that currency was retired
 * product-wide. (The exact old wording is deliberately NOT reproduced here: a
 * guard bans that phrasing on the RAW source, and quoting it would put the
 * defect back inside the sentence announcing its removal.) Read out of
 * production, not inferred: `approve_vendor_subscription` delegates to
 * `_apply_subscription_credit`, whose live body carries its own note — "The
 * token bundle and the add-on credit were REMOVED here (2026-08-07).
 * Activating a plan now activates a plan. Nothing else." — and returns
 * `bundle: 0`, `addon_tokens: 0` as constants.
 *
 * 🔑 `grant_admin_direct_tokens` IS STILL IN PRODUCTION, WHICH IS EXACTLY WHY
 * THIS SENTENCE SURVIVED A READING. Its continued existence makes the claim
 * look checkable and true; the only way to find out is to read the body of the
 * function that was supposed to call it. A named function is not a call site.
 * Its one remaining caller is `redeem_vendor_token_voucher` — not this path.
 *
 * Both RPCs (migration 20261010000000) gate on is_console_admin() and read
 * auth.uid() for the audit trail — so we call them through the admin's OWN
 * user-scoped client (NOT the service-role admin client, which has a null
 * auth.uid() and would fail the gate). This is also exactly the entry point a
 * future Maya / PayMongo webhook will hit (via the service-role-only
 * confirm_vendor_subscription_by_reference) to auto-activate on payment.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  notifyVendorSubscriptionActivated,
  notifyVendorSubscriptionRejected,
} from '@/lib/subscription-purchase-notify';

async function requireAdmin() {
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
    redirect('/dashboard');
  }
  return supabase;
}

export async function approveSubscription(formData: FormData): Promise<void> {
  const id = formData.get('purchase_id');
  if (typeof id !== 'string' || !id) {
    redirect('/admin/subscriptions?error=' + encodeURIComponent('Missing order id.'));
  }
  const supabase = await requireAdmin();

  const { data, error } = await supabase.rpc('approve_vendor_subscription', {
    p_purchase_id: id,
  });
  if (error) {
    redirect(
      '/admin/subscriptions?error=' +
        encodeURIComponent('Could not confirm: ' + (error.message ?? 'unknown error')),
    );
  }

  // Notify the vendor only on a NEW activation ({paid:true}); a re-confirm of an
  // already-paid order ({already:true}) shouldn't re-ping them. Fail-soft.
  const result = (data ?? {}) as { paid?: boolean; already?: boolean };
  if (result.paid) {
    await notifyVendorSubscriptionActivated(id as string);
  }

  revalidatePath('/admin/subscriptions');
  redirect('/admin/subscriptions?done=approved');
}

export async function rejectSubscription(formData: FormData): Promise<void> {
  const id = formData.get('purchase_id');
  const reason = formData.get('reason');
  if (typeof id !== 'string' || !id) {
    redirect('/admin/subscriptions?error=' + encodeURIComponent('Missing order id.'));
  }
  const supabase = await requireAdmin();

  const rejectReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : 'Payment not received';
  const { error } = await supabase.rpc('reject_vendor_subscription', {
    p_purchase_id: id,
    p_reason: rejectReason,
  });
  if (error) {
    redirect(
      '/admin/subscriptions?error=' +
        encodeURIComponent('Could not reject: ' + (error.message ?? 'unknown error')),
    );
  }

  // Tell the vendor their upgrade couldn't be confirmed + why. Fail-soft.
  await notifyVendorSubscriptionRejected(id, rejectReason);

  revalidatePath('/admin/subscriptions');
  redirect('/admin/subscriptions?done=rejected');
}
