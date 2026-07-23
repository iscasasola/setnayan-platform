import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor extra team seats — the Enterprise-only paid add-on beyond the base 10
 * seats (owner 2026-07-02 · ₱250 / 28-day each). Structural sibling of
 * `lib/vendor-branches.ts`, with ONE deliberate difference: an extra seat is a
 * persistent COUNT on the vendor profile (`vendor_profiles.extra_agent_seats`)
 * that folds into the Enterprise renewal — NOT a per-seat order with its own
 * 28-day window. So there is no per-seat status derivation here; the count is
 * the source of truth and the renewal re-bills it (PR-B).
 *
 * LIFECYCLE (PR-A): Enterprise admin taps "Add a seat" → apply-then-pay order
 * keyed `vendor_extra_seat__{vendor_profile_id}` → pays externally → admin
 * approves at /admin/payments → the sku-activation hook recomputes
 * extra_agent_seats (idempotent, ledger-guarded) → the seat is usable
 * immediately. PR-B folds the count into the Enterprise renewal amount and adds
 * the downgrade/lapse "admin picks who to drop" reconcile.
 */

/**
 * Extra-seat fee FALLBACK (owner 2026-07-02 · ₱250 / 28-day). The canonical,
 * admin-managed price lives in the `vendor_billing_catalog` row
 * `vendor_extra_seat` (price in PHP). Read it with {@link fetchSeatFeePhp};
 * this literal keeps the flow working at ₱250 if the seeding migration hasn't
 * been applied yet or RLS hides the row.
 */
export const SEAT_FEE_PHP = 250;

/** The catalog sku_code the extra-seat fee is read from (seeded by migration). */
export const SEAT_SKU_CODE = 'vendor_extra_seat';

/** 28-day billing cadence — one extra seat re-bills each Enterprise renewal. */
export const SEAT_PERIOD_DAYS = 28;

/**
 * Order service_key convention: `vendor_extra_seat__{vendor_profile_id}`. The
 * suffix lets the sku-activation hook map the paid order back to the exact
 * vendor whose seat count to bump — mirrors `vendor_additional_branch__{id}`.
 */
export const SEAT_SERVICE_KEY_PREFIX = 'vendor_extra_seat__';

export function seatServiceKey(vendorProfileId: string): string {
  return `${SEAT_SERVICE_KEY_PREFIX}${vendorProfileId}`;
}

export function vendorProfileIdFromSeatServiceKey(serviceKey: string): string | null {
  if (!serviceKey.startsWith(SEAT_SERVICE_KEY_PREFIX)) return null;
  const id = serviceKey.slice(SEAT_SERVICE_KEY_PREFIX.length);
  return id.length > 0 ? id : null;
}

/**
 * Normalise a `SELECT count` of PAID extra-seat orders into the number to store
 * on `vendor_profiles.extra_agent_seats`. Both the activation hook (on approval)
 * and the reversal hook (on refund/reject) RECOMPUTE from the live paid-order
 * count rather than increment/decrement, so the value is self-healing and never
 * double-counts. A null/negative count floors at 0. PURE (unit-testable).
 */
export function extraSeatsFromPaidCount(count: number | null | undefined): number {
  const n = Number(count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Effective team-seat cap = the tier's base `agentAccounts` + paid extra seats.
 * Extra seats are only ever > 0 for Enterprise/Custom (the buy flow is gated),
 * so this is a no-op for every other tier. `Infinity` base stays `Infinity`.
 */
export function effectiveSeatCap(baseCap: number, extraSeats: number): number {
  if (!Number.isFinite(baseCap)) return baseCap;
  const extra = Number.isFinite(extraSeats) && extraSeats > 0 ? Math.floor(extraSeats) : 0;
  return baseCap + extra;
}

/**
 * Read a vendor's paid extra-seat count. Soft-probe: any read failure (column
 * missing pre-migration, RLS) yields 0 so the seat cap degrades to the base
 * tier allowance rather than throwing.
 */
export async function fetchExtraAgentSeats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('extra_agent_seats')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) return 0;
    const n = Number((data as { extra_agent_seats?: number | null }).extra_agent_seats);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Resolve the live extra-seat fee (PHP) from the admin-managed catalog, falling
 * back to {@link SEAT_FEE_PHP} when the row is missing/unreadable. Mirrors
 * `fetchBranchFeePhp`.
 */
export async function fetchSeatFeePhp(supabase: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', SEAT_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return SEAT_FEE_PHP;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : SEAT_FEE_PHP;
  } catch {
    return SEAT_FEE_PHP;
  }
}
