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
 * NOTIFICATION TYPES: the admin "pending" signal uses
 * 'order_awaiting_reconciliation' and the vendor "your plan is live" signal
 * uses 'subscription_activated' (both added 2026-06-24 in
 * 20270221018919_add_order_reconciliation_notification_type.sql). These USED to
 * borrow the token enum values 'vendor_token_purchase_pending' /
 * 'vendor_tokens_credited', which made the tray badge read "TOKEN PURCHASE
 * AWAITING PAYMENT" / "TOKENS CREDITED" on a subscription — wrong (owner: "only
 * keep the vendor tokens"; a subscription is not a token pack). Real vendor
 * token-pack purchases keep the token types (lib/token-purchase-notify.ts). The
 * rejected path keeps 'vendor_status_change' (an account event, not a token).
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
          type: 'order_awaiting_reconciliation',
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
      type: 'subscription_activated',
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

/**
 * Tell the vendor their subscription upgrade couldn't be confirmed (payment not
 * received / couldn't be matched) and what to do next. Deep-links to the
 * subscription page so they can retry or re-upload proof. Uses the
 * 'vendor_status_change' type (a vendor-recipient, email-enabled account event)
 * so the "your account upgrade didn't go through" copy reaches their inbox.
 * Fail-soft — a notify failure never affects the reject RPC that already ran.
 */
export async function notifyVendorSubscriptionRejected(
  purchaseId: string,
  reason: string,
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
      type: 'vendor_status_change',
      title: `Your ${tier} upgrade couldn't be confirmed`,
      body: `Your ${tier} (${p.billing_cycle}) subscription (${peso(
        Number(p.amount_php),
      )}) was not confirmed. Reason: ${reason}. You can start a new upgrade or re-upload your payment proof from your subscription page.`,
      relatedUrl: '/vendor-dashboard/subscription',
    });
  } catch (e) {
    console.error('[subscription] vendor rejected notify failed:', e);
  }
}
