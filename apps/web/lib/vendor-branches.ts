import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor Branches — Enterprise sub-location accounts ("multiple accounts
 * depending on plans"). Owner-locked 2026-06-05: ₱1,000 / 28-day add-on,
 * Enterprise tier only, paid via the existing apply-then-pay order flow
 * (iteration 0034) and reconciled by a Setnayan admin at /admin/payments.
 *
 * The `vendor_branches` table + its RLS already exist (owner+admin manage via
 * current_vendor_profile_ids()). This module is the app layer: types, the
 * fixed fee, the order-keying convention, and the read that joins each branch
 * to its activation order so the dashboard can show active / pending-payment.
 *
 * SCOPE (V1): create → pay → admin approves → branch activates. Auto-renewal /
 * auto-lapse after 28 days is V1.x (manual re-charge for now) — the
 * order-key suffix means the generic subscription sweep deliberately skips it.
 */

/** Fixed Additional-Branch fee (owner-locked 2026-06-05). PHP + centavos. */
export const BRANCH_FEE_PHP = 1000;
export const BRANCH_FEE_CENTAVOS = BRANCH_FEE_PHP * 100;

/** 28-day billing period (informational; auto-lapse is V1.x). */
export const BRANCH_PERIOD_DAYS = 28;

/**
 * Order service_key convention: `vendor_additional_branch__{branch_id}`.
 * The suffix lets the admin approval hook map the paid order back to the exact
 * branch to activate. Mirrors the established `setnayan_service__{category}`
 * keying — a non-catalog service_key whose price is passed explicitly.
 */
export const BRANCH_SERVICE_KEY_PREFIX = 'vendor_additional_branch__';

export function branchServiceKey(branchId: string): string {
  return `${BRANCH_SERVICE_KEY_PREFIX}${branchId}`;
}

export function branchIdFromServiceKey(serviceKey: string): string | null {
  if (!serviceKey.startsWith(BRANCH_SERVICE_KEY_PREFIX)) return null;
  const id = serviceKey.slice(BRANCH_SERVICE_KEY_PREFIX.length);
  return id.length > 0 ? id : null;
}

export const BRANCH_RADIUS_MIN_KM = 1;
export const BRANCH_RADIUS_MAX_KM = 200;
export const BRANCH_LABEL_MAX = 120;
export const BRANCH_CITY_MAX = 120;

export type BranchStatus = 'active' | 'pending_payment' | 'cancelled';

export type VendorBranchRow = {
  branch_id: string;
  parent_vendor_profile_id: string;
  branch_label: string;
  branch_city: string;
  branch_radius_km: number;
  branch_subscription_active: boolean;
  created_at: string;
  cancelled_at: string | null;
};

export type VendorBranchView = VendorBranchRow & {
  status: BranchStatus;
  /** Reference code on the activation order — shown to the vendor to pay. */
  reference_code: string | null;
};

export function deriveBranchStatus(
  branch: Pick<VendorBranchRow, 'branch_subscription_active' | 'cancelled_at'>,
): BranchStatus {
  if (branch.cancelled_at) return 'cancelled';
  return branch.branch_subscription_active ? 'active' : 'pending_payment';
}

/**
 * Read a vendor's branches and enrich each with its activation-order reference
 * code (so a pending branch can show "pay ₱1,000, reference SN…"). Runs under
 * the caller's RLS: vendor_branches admits owner+admin; orders are owner-read
 * by user_id, so the reference code resolves for whoever created the order.
 */
export async function fetchVendorBranches(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorBranchView[]> {
  const { data, error } = await supabase
    .from('vendor_branches')
    .select(
      'branch_id,parent_vendor_profile_id,branch_label,branch_city,branch_radius_km,branch_subscription_active,created_at,cancelled_at',
    )
    .eq('parent_vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchVendorBranches failed: ${error.message}`);
  const branches = (data ?? []) as VendorBranchRow[];
  if (branches.length === 0) return [];

  // Pull the activation orders for these branches in one round-trip, newest
  // first, so each branch shows its most recent reference code.
  const keys = branches.map((b) => branchServiceKey(b.branch_id));
  const { data: orders } = await supabase
    .from('orders')
    .select('service_key,reference_code,created_at')
    .in('service_key', keys)
    .order('created_at', { ascending: false });

  const refByBranch = new Map<string, string>();
  for (const o of (orders ?? []) as Array<{ service_key: string; reference_code: string | null }>) {
    const id = branchIdFromServiceKey(o.service_key);
    if (id && !refByBranch.has(id) && o.reference_code) {
      refByBranch.set(id, o.reference_code);
    }
  }

  return branches.map((b) => ({
    ...b,
    status: deriveBranchStatus(b),
    reference_code: refByBranch.get(b.branch_id) ?? null,
  }));
}
