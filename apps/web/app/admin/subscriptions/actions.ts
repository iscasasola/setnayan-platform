'use server';

/**
 * /admin/subscriptions · server actions — reconcile vendor subscription orders.
 *
 * Apply-then-pay: a vendor starts a Pro/Enterprise upgrade (pending_payment) and
 * pays our BDO / GCash receiving account with the reference code in the note.
 * Once the payment lands in the inbox, an admin confirms it here.
 *
 *   approveSubscription → approve_vendor_subscription(id) sets tier_state +
 *     tier_expires_at (stacking) + grants the token bundle via
 *     grant_admin_direct_tokens (idempotent per purchase) + flips to 'paid'.
 *   rejectSubscription  → reject_vendor_subscription(id, reason).
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
import { notifyVendorSubscriptionActivated } from '@/lib/subscription-purchase-notify';

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

  const { error } = await supabase.rpc('reject_vendor_subscription', {
    p_purchase_id: id,
    p_reason:
      typeof reason === 'string' && reason.trim() ? reason.trim() : 'Payment not received',
  });
  if (error) {
    redirect(
      '/admin/subscriptions?error=' +
        encodeURIComponent('Could not reject: ' + (error.message ?? 'unknown error')),
    );
  }

  revalidatePath('/admin/subscriptions');
  redirect('/admin/subscriptions?done=rejected');
}
