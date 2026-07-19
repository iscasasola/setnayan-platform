'use server';

/**
 * /admin/token-purchases · server actions — reconcile vendor token-pack orders.
 *
 * Apply-then-pay: a vendor starts a purchase (pending_payment) and pays our
 * BDO / GCash receiving account with the reference code in the note. Once the
 * payment lands in the inbox, an admin confirms it here.
 *
 *   approveTokenPurchase → approve_vendor_token_purchase(id) credits the wallet
 *     via grant_admin_direct_tokens (idempotent per purchase) + flips to 'paid'.
 *   rejectTokenPurchase  → reject_vendor_token_purchase(id, reason).
 *
 * Both RPCs (migration 20260916000000) gate on is_console_admin() and read
 * auth.uid() for the audit trail — so we call them through the admin's OWN
 * user-scoped client (NOT the service-role admin client, which has a null
 * auth.uid() and would fail the gate). This is also exactly the entry point a
 * future Maya / PayMongo webhook will hit to auto-credit on payment.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  notifyVendorTokensCredited,
  notifyVendorTokenPurchaseRejected,
} from '@/lib/token-purchase-notify';

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

export async function approveTokenPurchase(formData: FormData): Promise<void> {
  const id = formData.get('purchase_id');
  if (typeof id !== 'string' || !id) {
    redirect('/admin/token-purchases?error=' + encodeURIComponent('Missing purchase id.'));
  }
  const supabase = await requireAdmin();

  const { data, error } = await supabase.rpc('approve_vendor_token_purchase', {
    p_purchase_id: id,
  });
  if (error) {
    redirect(
      '/admin/token-purchases?error=' +
        encodeURIComponent('Could not confirm: ' + (error.message ?? 'unknown error')),
    );
  }

  // Notify the vendor only on a NEW credit ({paid:true}); a re-confirm of an
  // already-paid order ({already:true}) shouldn't re-ping them. Fail-soft.
  const result = (data ?? {}) as { paid?: boolean; already?: boolean };
  if (result.paid) {
    await notifyVendorTokensCredited(id);
  }

  revalidatePath('/admin/token-purchases');
  redirect('/admin/token-purchases?done=approved');
}

export async function rejectTokenPurchase(formData: FormData): Promise<void> {
  const id = formData.get('purchase_id');
  const reason = formData.get('reason');
  if (typeof id !== 'string' || !id) {
    redirect('/admin/token-purchases?error=' + encodeURIComponent('Missing purchase id.'));
  }
  const supabase = await requireAdmin();

  const rejectReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : 'Payment not received';
  const { error } = await supabase.rpc('reject_vendor_token_purchase', {
    p_purchase_id: id,
    p_reason: rejectReason,
  });
  if (error) {
    redirect(
      '/admin/token-purchases?error=' +
        encodeURIComponent('Could not reject: ' + (error.message ?? 'unknown error')),
    );
  }

  // Tell the vendor their purchase couldn't be confirmed + why. Fail-soft.
  await notifyVendorTokenPurchaseRejected(id, rejectReason);

  revalidatePath('/admin/token-purchases');
  redirect('/admin/token-purchases?done=rejected');
}
