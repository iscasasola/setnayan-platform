import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Notification helpers for the vendor token-purchase flow. Both are
 * fail-soft (a failed notification never affects the underlying money/credit
 * action) and resolve everything they need from the purchase id, so the same
 * call works from a server action OR the payment webhook.
 *
 * emitNotification already drops the in-app row AND emails the recipient (via
 * Resend when configured) — so these are the single call for both channels.
 */

const peso = (n: number) =>
  '₱' + new Intl.NumberFormat('en-PH').format(Math.round(n));

/**
 * Fan out to every admin/internal/team user that a vendor started a token
 * purchase awaiting payment confirmation. Deep-links to the reconcile queue.
 */
export async function notifyAdminsTokenPurchasePending(
  purchaseId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('vendor_token_purchases')
      .select('vendor_id, token_count, amount_php, reference_code')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (!p) return;

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', p.vendor_id)
      .maybeSingle();
    const name = v?.business_name ?? 'A vendor';

    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'vendor_token_purchase_pending',
          title: `Token purchase awaiting payment · ${name}`,
          body: `${name} started a ${p.token_count}-token purchase (${peso(
            Number(p.amount_php),
          )}). Confirm payment once it lands. Ref ${p.reference_code}.`,
          relatedUrl: '/admin/token-purchases',
        }),
      ),
    );
  } catch (e) {
    console.error('[token-purchase] admin pending notify failed:', e);
  }
}

/**
 * Tell the vendor their token purchase was confirmed and the tokens are in
 * their wallet. Deep-links to the wallet.
 */
export async function notifyVendorTokensCredited(
  purchaseId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('vendor_token_purchases')
      .select('vendor_id, token_count, amount_php')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (!p) return;

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', p.vendor_id)
      .maybeSingle();
    if (!v?.user_id) return; // unclaimed vendor — no account to notify yet

    await emitNotification({
      userId: v.user_id as string,
      type: 'vendor_tokens_credited',
      title: `${p.token_count} tokens added to your wallet`,
      body: `We confirmed your ${peso(
        Number(p.amount_php),
      )} payment. Your purchased tokens never expire — use them to unlock matched couples whenever you're ready.`,
      relatedUrl: '/vendor-dashboard/tokens',
    });
  } catch (e) {
    console.error('[token-purchase] vendor credited notify failed:', e);
  }
}

/**
 * Tell the vendor their token purchase was rejected (payment not received /
 * couldn't be matched) and what to do next. Deep-links to the wallet so they
 * can retry or re-upload proof. Fail-soft — a notify failure never affects the
 * reject RPC that already ran.
 */
export async function notifyVendorTokenPurchaseRejected(
  purchaseId: string,
  reason: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('vendor_token_purchases')
      .select('vendor_id, token_count, amount_php')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (!p) return;

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', p.vendor_id)
      .maybeSingle();
    if (!v?.user_id) return; // unclaimed vendor — no account to notify yet

    await emitNotification({
      userId: v.user_id as string,
      type: 'vendor_status_change',
      title: `Token purchase couldn't be confirmed`,
      body: `Your ${p.token_count}-token purchase (${peso(
        Number(p.amount_php),
      )}) was not confirmed. Reason: ${reason}. You can start a new purchase or re-upload your payment proof from your wallet.`,
      relatedUrl: '/vendor-dashboard/tokens',
    });
  } catch (e) {
    console.error('[token-purchase] vendor rejected notify failed:', e);
  }
}
