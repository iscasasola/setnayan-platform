import type { SupabaseClient } from '@supabase/supabase-js';
import { tierCaps } from './vendor-tier-caps';

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
 * flow keeps working regardless of migration state. The UI still imports this
 * for static copy; the order-creation path resolves the live price.
 *
 * 🚨 IT IS ALSO A BACK DOOR UNDER THE PRICE, and it was one: this read ₱999 for
 * the whole day the owner raised `vendor_additional_branch` to ₱1,000
 * (2026-08-27). Any failed or pre-migration catalog read would have quietly
 * charged yesterday's price while the catalog looked correct — the same shape
 * as the Custom-base fallback found the same day, which would have put a whole
 * tier back below Enterprise. ⛔ THIS NUMBER IS A SECOND COPY OF A CATALOG
 * PRICE: move it in the SAME change as the migration.
 * `custom-sits-above-enterprise.db.test.ts` now compares every declared fallback
 * against its live catalog row and fails the build on drift.
 */
export const BRANCH_FEE_PHP = 1000;
export const BRANCH_FEE_CENTAVOS = BRANCH_FEE_PHP * 100;

/** The catalog sku_code the branch fee is read from (seeded by migration). */
export const BRANCH_SKU_CODE = 'vendor_additional_branch';

/** 28-day billing window. The admin approval hook stamps orders.expires_at. */
export const BRANCH_PERIOD_DAYS = 28;

/**
 * Order service_key convention: `vendor_additional_branch__{branch_id}`.
 * The suffix lets the admin approval hook map the paid order back to the exact
 * branch to activate.
 *
 * ⚠ This used to say it "mirrors the established `setnayan_service__{category}`
 * keying". That convention was REMOVED 2026-07-26 (owner ruling) and the two
 * were never really alike in the way that matters: the branch fee is read from
 * `vendor_billing_catalog` via `fetchBranchFeePhp()` — an ADMIN-set table —
 * whereas the Setnayan-service key ultimately priced off
 * `event_vendors.total_cost_php`, a column the paying customer writes. A
 * suffixed non-catalog service_key is fine; a suffixed key whose price comes
 * from a customer-writable column is the bug. Do not cite the removed one as
 * precedent.
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
export const BRANCH_ADDRESS_MAX = 300;

/**
 * Automatic branch service radius (km). Range is no longer a manual input
 * (owner 2026-07-02 "range is automatic") — a branch inherits the Enterprise
 * tier reach (vendor-tier-caps · serviceRadiusKm), clamped to the column's
 * stored max. Branches are Enterprise-only, so this resolves to the Enterprise
 * ceiling; the clamp is a defensive floor/ceiling if that cap ever changes.
 */
export function branchAutoRadiusKm(): number {
  const reach = tierCaps('enterprise').serviceRadiusKm;
  if (!Number.isFinite(reach) || reach <= 0) return BRANCH_RADIUS_MAX_KM;
  return Math.min(Math.max(BRANCH_RADIUS_MIN_KM, Math.round(reach)), BRANCH_RADIUS_MAX_KM);
}

export type BranchStatus = 'active' | 'pending_payment' | 'expired' | 'cancelled';

/**
 * The ONE question every branch surface asks: may this branch be USED?
 *
 * Owner-ruled 2026-08-28, one word — **"paid"**. A branch is a paid add-on, so
 * nothing it unlocks happens before the fee is in and the 28-day window is
 * live: it is not shown to customers, and no service card may be newly filed
 * under it. `pending_payment` and `expired` are both "not yet"; `cancelled`
 * is "no".
 *
 * ⚠ WHAT THIS REPLACED, because the shape recurs: the branch picker and the
 * My Shop list both filtered on `status !== 'cancelled'`, so a branch that had
 * never been paid for was fully usable and paying flipped a chip from orange
 * to green and did nothing else. One rule, one name, one place — the picker,
 * the server-side resolve and the public read all call THIS.
 */
export function branchIsUsable(status: BranchStatus): boolean {
  return status === 'active';
}

/** The refusal a vendor reads when they try to file a card under an unpaid branch. */
export const BRANCH_NOT_ACTIVE_MESSAGE =
  'That branch is not active yet. Pay its fee and we will switch it on \u2014 until then, file this under your main location.';

export type BranchAssignment =
  | { ok: true; branchId: string | null }
  | { ok: false; message: string };

/**
 * The refusal when the branch's paid state could not be READ at all.
 * Deliberately not {@link BRANCH_NOT_ACTIVE_MESSAGE}: telling a vendor their
 * paid branch is unpaid because a query stumbled is a false statement about
 * their money, and they would go and pay again.
 */
export const BRANCH_STATUS_UNREADABLE_MESSAGE =
  'We could not check that branch just now. Please try again in a moment.';

/** "Owned, but we could not tell whether it is paid up." */
export type RequestedBranchStatus = BranchStatus | 'unknown' | null;

/**
 * Decide which branch a service card is filed under. PURE on purpose — the
 * ownership lookup and the paid-status read happen in the server action; this
 * is the rule, and it is the thing the tests pin.
 *
 * - nothing requested → main (no branch). Unchanged.
 * - a branch this vendor does not own → main. Unchanged: a foreign id is a
 *   forgery, and coercing it is the long-standing behaviour.
 * - an ACTIVE branch → filed there.
 * - an unpaid / lapsed branch the card is ALREADY filed under → kept.
 *   Keeping a card where it already sits is not a NEW use of an unpaid branch,
 *   and silently moving it to "main" during an unrelated edit would delete the
 *   vendor's own filing with nothing said on screen. The branch is still
 *   invisible to customers either way.
 * - an unpaid / lapsed branch, newly chosen → REFUSED, in words.
 * - a branch whose paid state could not be READ → refused in DIFFERENT words.
 *   "Your branch is not active" and "we could not check" are not the same
 *   sentence, and only one of them is true during an outage.
 */
export function resolveBranchAssignment(input: {
  requested: string | null;
  requestedStatus: RequestedBranchStatus;
  current: string | null;
}): BranchAssignment {
  const { requested, requestedStatus, current } = input;
  if (!requested) return { ok: true, branchId: null };
  if (requestedStatus === null) return { ok: true, branchId: null };
  if (requestedStatus !== 'unknown' && branchIsUsable(requestedStatus)) {
    return { ok: true, branchId: requested };
  }
  if (current !== null && current === requested) return { ok: true, branchId: requested };
  return {
    ok: false,
    message:
      requestedStatus === 'unknown'
        ? BRANCH_STATUS_UNREADABLE_MESSAGE
        : BRANCH_NOT_ACTIVE_MESSAGE,
  };
}

export type VendorBranchRow = {
  branch_id: string;
  parent_vendor_profile_id: string;
  branch_label: string;
  branch_city: string;
  branch_radius_km: number;
  branch_latitude: number | null;
  branch_longitude: number | null;
  branch_address: string | null;
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
 * The latest activation order per branch, newest first (so renewals win).
 * Split out of {@link fetchVendorBranches} because the PUBLIC read needs the
 * same derivation without the dashboard's session-scoped branch read.
 */
export async function fetchLatestBranchOrders(
  orderReader: SupabaseClient,
  branchIds: string[],
): Promise<Map<string, LatestOrder>> {
  const latest = new Map<string, LatestOrder>();
  if (branchIds.length === 0) return latest;
  const { data, error } = await orderReader
    .from('orders')
    .select('service_key,reference_code,status,expires_at,created_at')
    .in('service_key', branchIds.map(branchServiceKey))
    .order('created_at', { ascending: false });
  // 🔑 THROWS rather than returning an empty map. "I could not read the orders"
  // and "this branch has never been paid for" produce the same empty result,
  // and now that the answer decides whether a branch is public and usable, the
  // two need different handling: the public read must claim nothing, the
  // dashboard must still list the branch, and the write path must refuse in
  // words that are TRUE. Each caller says which it wants; none may inherit
  // "unpaid" from a network blip by accident.
  if (error) throw new Error(`fetchLatestBranchOrders failed: ${error.message}`);
  for (const o of (data ?? []) as Array<LatestOrder & { service_key: string }>) {
    const id = branchIdFromServiceKey(o.service_key);
    if (id && !latest.has(id)) {
      latest.set(id, {
        reference_code: o.reference_code,
        status: o.status,
        expires_at: o.expires_at,
      });
    }
  }
  return latest;
}

/**
 * Read a vendor's branches and enrich each with its latest activation order so
 * the dashboard can show active / pending / expired + the reference code to pay.
 * The BRANCH rows run under the caller's RLS (vendor_branches admits
 * owner+admin), which is right: they are that shop's rows.
 *
 * ⚠ `orderReader` — PASS A SERVICE-ROLE CLIENT. The activation orders are read
 * under `orders_owner_read` (`user_id = auth.uid() OR is_admin() OR …`), so a
 * shop's OTHER manager cannot see the order the shop's owner paid: the branch
 * reads back to them as `pending_payment` while it is live. That was merely
 * cosmetic while nothing gated on the status. It is a FALSE REFUSAL now that
 * being usable and being public both hang off it — so every manager of the
 * shop must read the same answer. The id it is scoped by is resolved from the
 * session, never from form input.
 *
 * It is REQUIRED rather than defaulting to `supabase` on purpose: a default
 * that is the wrong value is how the next caller inherits a bug silently. The
 * compiler now asks every new caller which client it means.
 */
export async function fetchVendorBranches(
  supabase: SupabaseClient,
  vendorProfileId: string,
  orderReader: SupabaseClient,
): Promise<VendorBranchView[]> {
  const { data, error } = await supabase
    .from('vendor_branches')
    .select(
      'branch_id,parent_vendor_profile_id,branch_label,branch_city,branch_radius_km,branch_latitude,branch_longitude,branch_address,branch_subscription_active,created_at,cancelled_at',
    )
    .eq('parent_vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchVendorBranches failed: ${error.message}`);
  const branches = (data ?? []) as VendorBranchRow[];
  if (branches.length === 0) return [];

  // Direction on a read error: KEEP LISTING THE BRANCHES. This is the shop's
  // own management screen — hiding a vendor's branches because one query
  // stumbled is worse than showing them without their reference code. They
  // read as `pending_payment`, which is what the screen showed before this
  // function could tell the two apart; the WRITE path is where a wrong answer
  // would cost something, and it fails differently on purpose.
  const latestByBranch = await fetchLatestBranchOrders(
    orderReader,
    branches.map((b) => b.branch_id),
  ).catch(() => new Map<string, LatestOrder>());

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

/** What a CUSTOMER is shown about a branch: its name and the city it is in. */
export type PublicVendorBranch = {
  branchId: string;
  branchLabel: string;
  branchCity: string;
};

/**
 * The shop's other locations, as a customer may see them (owner-ruled
 * 2026-08-28: **yes**, customers should see a supplier's branches).
 *
 * 🔒 THREE DELIBERATE NARROWINGS, all of them the point of this function:
 *
 * 1. **PAID AND LIVE ONLY.** `branchIsUsable` is the gate, so an unpaid,
 *    lapsed or cancelled branch is not a public claim about where this shop
 *    works.
 * 2. **NAME AND CITY ONLY.** The street address, the pin, the service radius,
 *    the parent id and the internal `branch_subscription_active` flag are
 *    never projected. A customer needs to know the shop is in their city; the
 *    rest is the shop's operational detail.
 * 3. **FAILS CLOSED.** A read error returns an empty list, never a partial or
 *    unfiltered one — a public page must not make a claim it could not check.
 *
 * ⚠ `reader` must be a SERVICE-ROLE client. `vendor_branches` has policies for
 * `authenticated` only and none for `anon`, so a public page cannot read it
 * through a visitor's session — and the fix for that is NOT a blanket `anon`
 * read on the table (which would hand out every unpaid and cancelled branch,
 * with its address and coordinates, to anyone with the public key). This is
 * the shop's own public data, keyed by the shop the page is already rendering.
 */
export async function fetchPublicVendorBranches(
  reader: SupabaseClient,
  vendorProfileId: string,
  nowMs: number = Date.now(),
): Promise<PublicVendorBranch[]> {
  const { data, error } = await reader
    .from('vendor_branches')
    .select('branch_id,branch_label,branch_city,cancelled_at,created_at')
    .eq('parent_vendor_profile_id', vendorProfileId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  const rows = data as Array<
    Pick<VendorBranchRow, 'branch_id' | 'branch_label' | 'branch_city' | 'cancelled_at'>
  >;
  if (rows.length === 0) return [];

  let latest: Map<string, LatestOrder>;
  try {
    latest = await fetchLatestBranchOrders(
      reader,
      rows.map((r) => r.branch_id),
    );
  } catch {
    return [];
  }

  return rows
    .filter((r) => branchIsUsable(deriveBranchStatus(r, latest.get(r.branch_id), nowMs)))
    .map((r) => ({
      branchId: r.branch_id,
      branchLabel: r.branch_label,
      branchCity: r.branch_city,
    }));
}
