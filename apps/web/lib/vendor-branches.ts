import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor Branches — Enterprise sub-location accounts ("multiple accounts
 * depending on plans"). Owner-locked 2026-06-05: ₱999 / 28-day add-on,
 * Enterprise tier only, paid via the existing apply-then-pay order flow
 * (iteration 0034) and reconciled by a Setnayan admin at /admin/payments.
 *
 * The `vendor_branches` table + its RLS already exist (owner+admin manage via
 * current_vendor_profile_ids()). This module is the app layer: types, the
 * fixed fee, the order-keying convention, and the read that joins each branch
 * to its activation order so the dashboard can show active / pending / expired.
 *
 * LIFECYCLE: create → pay → admin approves → branch activates with a 28-day
 * window (orders.expires_at, stamped by the admin approval hook). A branch's
 * live status is DERIVED from its latest activation order — paid + in-window =
 * active; paid + past the window = expired (a "Renew" creates a fresh ₱999
 * order); unpaid = pending payment. So lapse is automatic at read time (no
 * cron, no sweep — the suffixed service_key is excluded from the generic
 * subscription sweep on purpose). Renewal is one tap → a new apply-then-pay
 * order; auto-charge is N/A in the apply-then-pay model (no card on file).
 */

/**
 * Additional-Branch fee FALLBACK (owner-locked 2026-06-05 · ₱999 charm).
 *
 * The canonical, admin-managed price now lives in the `vendor_billing_catalog`
 * row `vendor_additional_branch` (price stored in PHP — owner rule 2026-06-19
 * "prices are admin-managed"). Read it server-side with `fetchBranchFeePhp()`.
 * This literal is the BACKWARD-COMPATIBLE fallback used when the catalog row is
 * missing (e.g. the seeding migration hasn't been applied yet) — so the branch
 * flow keeps working at ₱999 regardless of migration state. The UI still
 * imports this for static copy; the order-creation path resolves the live price.
 */
export const BRANCH_FEE_PHP = 999;
export const BRANCH_FEE_CENTAVOS = BRANCH_FEE_PHP * 100;

/** The catalog sku_code the branch fee is read from (seeded by migration). */
export const BRANCH_SKU_CODE = 'vendor_additional_branch';

/** 28-day billing window. The admin approval hook stamps orders.expires_at. */
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

/**
 * Resolve the live Additional-Branch fee (in PHP) from the admin-managed
 * catalog, falling back to the {@link BRANCH_FEE_PHP} literal when the
 * `vendor_additional_branch` row is missing or unreadable. Mirrors how every
 * other vendor SKU is read (vendor_billing_catalog · `Number(price_php)`).
 *
 * Backward-compatible by construction: if the seeding migration hasn't been
 * applied yet (or RLS hides the row), the order is still created at ₱999. Any
 * non-positive / non-finite price is treated as missing and falls back too.
 */
export async function fetchBranchFeePhp(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', BRANCH_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return BRANCH_FEE_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : BRANCH_FEE_PHP;
  } catch {
    return BRANCH_FEE_PHP;
  }
}

export const BRANCH_RADIUS_MIN_KM = 1;
export const BRANCH_RADIUS_MAX_KM = 200;
export const BRANCH_LABEL_MAX = 120;
export const BRANCH_CITY_MAX = 120;

export type BranchStatus = 'active' | 'pending_payment' | 'expired' | 'cancelled';

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
  /** Reference code on the latest activation order — shown to the vendor to pay. */
  reference_code: string | null;
  /** End of the paid window (ISO), when the branch is/was active. */
  expires_at: string | null;
};

/** The latest activation order for a branch, as far as status derivation needs. */
type LatestOrder = {
  reference_code: string | null;
  status: string | null;
  expires_at: string | null;
};

/**
 * Derive a branch's live status from its latest activation order. Lapse is
 * automatic here — a paid order past its 28-day window reads as `expired`
 * (no cron / no sweep needed). `nowMs` is the comparison clock.
 */
export function deriveBranchStatus(
  branch: Pick<VendorBranchRow, 'cancelled_at'>,
  order: LatestOrder | undefined,
  nowMs: number,
): BranchStatus {
  if (branch.cancelled_at) return 'cancelled';
  if (order?.status === 'paid') {
    const exp = order.expires_at ? Date.parse(order.expires_at) : NaN;
    if (Number.isFinite(exp) && exp <= nowMs) return 'expired';
    return 'active';
  }
  return 'pending_payment';
}

/**
 * Read a vendor's branches and enrich each with its latest activation order so
 * the dashboard can show active / pending / expired + the reference code to pay.
 * Runs under the caller's RLS: vendor_branches admits owner+admin; orders are
 * owner-read by user_id, so the order resolves for whoever created it.
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
  // first, so each branch maps to its MOST RECENT order (handles renewals).
  const keys = branches.map((b) => branchServiceKey(b.branch_id));
  const { data: orders } = await supabase
    .from('orders')
    .select('service_key,reference_code,status,expires_at,created_at')
    .in('service_key', keys)
    .order('created_at', { ascending: false });

  const latestByBranch = new Map<string, LatestOrder>();
  for (const o of (orders ?? []) as Array<
    LatestOrder & { service_key: string }
  >) {
    const id = branchIdFromServiceKey(o.service_key);
    if (id && !latestByBranch.has(id)) {
      latestByBranch.set(id, {
        reference_code: o.reference_code,
        status: o.status,
        expires_at: o.expires_at,
      });
    }
  }

  const nowMs = Date.now();
  return branches.map((b) => {
    const order = latestByBranch.get(b.branch_id);
    return {
      ...b,
      status: deriveBranchStatus(b, order, nowMs),
      reference_code: order?.reference_code ?? null,
      expires_at: order?.expires_at ?? null,
    };
  });
}
