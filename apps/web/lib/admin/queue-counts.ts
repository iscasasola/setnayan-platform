import { createAdminClient } from '@/lib/supabase/admin';

/**
 * getAdminQueueCounts — single source of truth for the open-work count of
 * every admin "Work" queue. Keyed by the nav item key (`admin.sidebar.<key>`),
 * so the result drops straight onto ADMIN_NAV_GROUPS items as a `badge` AND
 * onto the /admin/work triage-feed rows AND the /admin overview tiles.
 *
 * WHY (2026-06-28): this exact head-count Promise.all was written THREE times
 * independently — the /admin/work feed, the /admin overview, and (per-filter)
 * each queue page. The copies already drifted once (verify counted vendor
 * profiles `coming_soon` in one place vs applications `pending_review` in
 * another). Consolidating to one helper is the real efficiency win behind the
 * nav-badge feature: the always-on nav finally shows "3 disputes" without the
 * admin opening the page, and there's now one filter set to keep correct.
 *
 * Each filter MUST mirror its destination page's own filter so the badge count
 * matches the rows the admin sees on arrival. (Canonical filter table lived in
 * the /admin/work docblock; it now lives here.)
 *
 * Value semantics: `number` = live open count; `null` = the table/query was
 * unavailable (renamed/missing). A head-count query resolves to { count: null }
 * rather than throwing, so one broken queue degrades to "unknown" (no badge in
 * the nav · a chevron in the triage feed) instead of 500-ing the whole admin
 * layout. Callers must treat null as unknown, never as 0.
 */
export type AdminQueueCounts = Record<string, number | null>;

export async function getAdminQueueCounts(): Promise<AdminQueueCounts> {
  const admin = createAdminClient();
  const head = { count: 'exact', head: true } as const;
  const nowIso = new Date().toISOString();

  const [
    verifyRes,
    paymentsRes,
    payoutsRes,
    tokenSalesRes,
    subscriptionsRes,
    paymentOptionsRes,
    disputesRes,
    forceMajeureRes,
    reviewsRes,
    abuseRes,
    accountDeletionsRes,
    approvalsRes,
    helpRes,
    partnershipsRes,
  ] = await Promise.all([
    // Verify — applications awaiting review (vendor_verification_applications ·
    // pending_review), NOT the secondary visibility surface (vendor_profiles
    // coming_soon). This is the filter the earlier drift got wrong.
    admin
      .from('vendor_verification_applications')
      .select('*', head)
      .eq('status', 'pending_review'),
    admin.from('payments').select('*', head).eq('status', 'pending'),
    admin
      .from('vendor_payouts')
      .select('*', head)
      .is('paid_at', null)
      .eq('on_hold', false),
    admin
      .from('vendor_token_purchases')
      .select('*', head)
      .eq('status', 'pending_payment'),
    admin
      .from('vendor_subscriptions')
      .select('*', head)
      .eq('status', 'pending_payment'),
    admin
      .from('vendor_payment_methods')
      .select('*', head)
      .in('moderation_status', ['pending_review', 'held']),
    admin.from('vendor_disputes').select('*', head).eq('status', 'open'),
    admin
      .from('force_majeure_flags')
      .select('*', head)
      .in('status', ['open', 'under_review']),
    admin.from('vendor_review_appeals').select('*', head).is('decided_at', null),
    admin
      .from('concierge_abuse_flags')
      .select('*', head)
      .eq('status', 'pending_review'),
    admin
      .from('account_deletion_requests')
      .select('*', head)
      .eq('status', 'pending'),
    admin
      .from('admin_approval_requests')
      .select('*', head)
      .eq('status', 'pending')
      .gt('expires_at', nowIso),
    admin
      .from('help_messages')
      .select('*', head)
      .in('status', ['new', 'in_progress']),
    // Vendor partnerships — unverified + active = awaiting HQ two-admin review.
    admin
      .from('vendor_partnerships')
      .select('*', head)
      .eq('admin_verified', false)
      .eq('is_active', true),
  ]);

  const n = (c: number | null | undefined): number | null =>
    typeof c === 'number' ? c : null;

  // Keys MUST match the ADMIN_NAV_GROUPS Work-item keys + the triage-feed row
  // keys 1:1 so a count drops straight onto the matching nav item / row.
  return {
    verify: n(verifyRes.count),
    payments: n(paymentsRes.count),
    payouts: n(payoutsRes.count),
    'token-purchases': n(tokenSalesRes.count),
    subscriptions: n(subscriptionsRes.count),
    'payment-options': n(paymentOptionsRes.count),
    disputes: n(disputesRes.count),
    'force-majeure': n(forceMajeureRes.count),
    reviews: n(reviewsRes.count),
    'concierge-abuse': n(abuseRes.count),
    'account-deletions': n(accountDeletionsRes.count),
    approvals: n(approvalsRes.count),
    help: n(helpRes.count),
    'vendor-partnerships': n(partnershipsRes.count),
  };
}
