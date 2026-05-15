import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Decision 1 (CLAUDE.md 2026-05-15) — § 3.1a Self-purchase confirm.
 *
 * When a user about to check out is themselves a vendor (owner or team
 * member) of any vendor profile, the cart shows a confirm modal with two
 * CTAs: "Pay full price" (standard flow) or "Comp for myself" (audit-logged
 * self-comp).
 *
 * V1 schema doesn't yet have a cart_items <-> vendor SKU binding so the
 * detection runs on a coarser signal — "is this user a vendor owner / team
 * member at all?" — and the modal asks the user to confirm before they
 * submit a custom-quote order. When the cart-items-to-vendor binding lands
 * the same module wires per-line detection (the spec's exact rule).
 *
 * The 12-grants-per-quarter rate-limit is enforced inside the Postgres
 * BEFORE INSERT trigger on `comp_grants` (`enforce_vendor_self_comp_quota`).
 */

export type SelfPurchaseRole = {
  vendor_profile_id: string;
  business_name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
};

/**
 * Returns the vendor profiles the signed-in user owns or sits on the team
 * of. An empty array means the user has no vendor-side relationship — no
 * confirm modal needed at checkout.
 */
export async function fetchSelfPurchaseRoles(
  supabase: SupabaseClient,
  userId: string,
): Promise<SelfPurchaseRole[]> {
  const { data, error } = await supabase
    .from('vendor_team_members')
    .select('vendor_profile_id, role, vendor_profile:vendor_profiles(business_name)')
    .eq('user_id', userId);
  if (error) return [];
  type RawRow = {
    vendor_profile_id: string;
    role: 'owner' | 'admin' | 'agent' | 'viewer';
    vendor_profile: { business_name: string | null } | { business_name: string | null }[] | null;
  };
  const rows = ((data ?? []) as unknown) as RawRow[];
  return rows.map((r) => {
    // Supabase returns a single related row as either an object or a
    // single-element array depending on whether the relationship is treated
    // as one-to-one or one-to-many; handle both.
    const vp = Array.isArray(r.vendor_profile)
      ? (r.vendor_profile[0] ?? null)
      : r.vendor_profile;
    return {
      vendor_profile_id: r.vendor_profile_id,
      business_name: vp?.business_name ?? 'Unnamed vendor',
      role: r.role,
    };
  });
}

/**
 * Snapshot of the current quarter's self-comp usage. Returns the cap (12 by
 * default, admin-raisable via vendor_self_comp_caps), the current count, and
 * whether the user can still issue a new self-comp this quarter.
 */
export type SelfCompQuota = {
  vendor_profile_id: string;
  quarterly_cap: number;
  quarter_used: number;
  remaining: number;
};

export async function fetchSelfCompQuota(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<SelfCompQuota> {
  const capRow = await supabase
    .from('vendor_self_comp_caps')
    .select('quarterly_cap')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const cap = (capRow.data?.quarterly_cap as number | undefined) ?? 12;

  // Quarter boundary in PHT — use the server's NOW() via a select on the
  // comp_grants table itself filtered to this quarter.
  const now = new Date();
  const quarter = Math.floor(now.getUTCMonth() / 3);
  const quarterStartMonth = quarter * 3;
  const quarterStart = new Date(
    Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1, 0, 0, 0),
  );
  const { count } = await supabase
    .from('comp_grants')
    .select('grant_id', { count: 'exact', head: true })
    .eq('source', 'vendor_self_comp')
    .eq('vendor_profile_id', vendorProfileId)
    .is('revoked_at', null)
    .gte('created_at', quarterStart.toISOString());

  const used = count ?? 0;
  return {
    vendor_profile_id: vendorProfileId,
    quarterly_cap: cap,
    quarter_used: used,
    remaining: Math.max(0, cap - used),
  };
}
