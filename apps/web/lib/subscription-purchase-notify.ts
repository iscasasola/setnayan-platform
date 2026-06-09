import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Notification helpers for the vendor SUBSCRIPTION (Pro/Enterprise) checkout
 * flow (Phase D). Cloned from lib/token-purchase-notify.ts. Both are fail-soft
 * (a failed notification never affects the underlying money/credit action) and
 * resolve everything they need from the purchase id, so the same call works
 * from a server action OR the payment webhook.
 *
 * NOTIFICATION TYPE REUSE: these reuse the existing 'vendor_token_purchase_
 * pending' / 'vendor_tokens_credited' notification_type enum values rather than
 * minting subscription-specific ones — the single allowed migration for this
 * change is BEGIN/COMMIT-wrapped, and `ALTER TYPE ... ADD VALUE` cannot run in a
 * transaction block. The semantics line up (a vendor money action awaiting
 * admin reconcile / a credited result) and the title + body carry the
 * subscription specifics. Mint dedicated types in a follow-up enum-only
 * migration if the inbox needs to distinguish them.
 */

const peso = (n: number) =>
  '₱' + new Intl.NumberFormat('en-PH').format(Math.round(n));

const TIER_LABEL: Record<string, string> = {
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/**
 * Fan out to every admin/internal/team user that a vendor started a
 * subscription upgrade awaiting payment confirmation. Deep-links to the
 * reconcile queue.
 */
export async function notifyAdminsSubscriptionPending(
  purchaseId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('vendor_subscriptions')
      .select('vendor_id, tier, billing_cycle, amount_php, reference_code')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (!p) return;

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', p.vendor_id)
      .maybeSingle();
    const name = v?.business_name ?? 'A vendor';
    const tier = TIER_LABEL[p.tier as string] ?? (p.tier as string);

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
          title: `Subscription awaiting payment · ${name}`,
          body: `${name} started a ${tier} (${p.billing_cycle}) subscription (${peso(
            Number(p.amount_php),
          )}). Confirm payment once it lands. Ref ${p.reference_code}.`,
          relatedUrl: '/admin/subscriptions',
        }),
      ),
    );
  } catch (e) {
    console.error('[subscription] admin pending notify failed:', e);
  }
}

/**
 * Tell the vendor their subscription was activated. Deep-links to the
 * subscription page.
 */
export async function notifyVendorSubscriptionActivated(
  purchaseId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('vendor_subscriptions')
      .select('vendor_id, tier, billing_cycle, amount_php')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (!p) return;

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', p.vendor_id)
      .maybeSingle();
    if (!v?.user_id) return; // unclaimed vendor — no account to notify yet

    const tier = TIER_LABEL[p.tier as string] ?? (p.tier as string);

    await emitNotification({
      userId: v.user_id as string,
      type: 'vendor_tokens_credited',
      title: `Your ${tier} plan is active`,
      body: `We confirmed your ${peso(
        Number(p.amount_php),
      )} payment. Your ${tier} (${p.billing_cycle}) plan is live, with the bundled tokens added to your wallet.`,
      relatedUrl: '/vendor-dashboard/subscription',
    });
  } catch (e) {
    console.error('[subscription] vendor activated notify failed:', e);
  }
}
