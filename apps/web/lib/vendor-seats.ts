import type { SupabaseClient } from '@supabase/supabase-js';
import { holdsBoughtExtras, holdsExtraSeats, ULTRA_ADDON_GIVES } from './vendor-tier-caps';

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
 *
 * ⏳ SUPERSEDED IN TWO WAYS (2026-11-19 → 22). (1) No single seat is SOLD on any plan since 2026-11-19 — the Ultra
 * Add-on (+3 people) is the one add-on. (2) A seat already paid for is NOT a count that lasts for good: by the
 * controller's ruling on PR #8019 (22 Nov, "a 28-day window per paid order") each paid seat order carries its own
 * window (`orders.expires_at` = approval + 28 days), the stored count is the paid orders whose window covers now
 * (`recomputeVendorExtraSeats`, lib/sku-activation.ts), and `recount_vendor_count_addons()` lowers it when a window
 * lapses. PR-B (folding seats into the plan renewal) was never built and there is no seat renewal in the app, so a
 * held seat runs out 28 days after it was approved. 🔒 lib/a-paid-seat-lasts-28-days.test.ts
 */

/*
 * 💰 NO TYPED SEAT FEE (truth sweep, owner 2026-11-13: the site carries no typed prices). The extra-seat fee is the
 * `vendor_billing_catalog` row `vendor_extra_seat`, read by {@link fetchSeatFeePhp}. The `SEAT_FEE_PHP` literal that
 * used to stand in for an unread row is deleted: it was shown on the Team page AND minted into the seat order, so a
 * failed read quoted and charged a remembered price. Now an unread row shows no figure and the sale is refused.
 */

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
 * Extra seats are only ever > 0 for Ultra (the buy flow is gated),
 * so this is a no-op for every other tier. `Infinity` base stays `Infinity`.
 */
export function effectiveSeatCap(baseCap: number, extraSeats: number): number {
  if (!Number.isFinite(baseCap)) return baseCap;
  const extra = Number.isFinite(extraSeats) && extraSeats > 0 ? Math.floor(extraSeats) : 0;
  return baseCap + extra;
}

/**
 * 🧮 THE PEOPLE A SHOP HOLDS ON TOP OF ITS PLAN — THE ONE HOME OF THE RULE (fix pass on PR #8019, 22 Nov). Read by the
 * Team page's cap, the invite gate and the seat-pause job, so the three can never disagree about who has a seat:
 *   · the single extra seats already paid for (`extra_agent_seats` — no longer SOLD since 2026-11-19, kept while paid),
 *     on a plan that HOLDS them (`holdsExtraSeats` — Ultra, the only plan that could buy one; the same rule the
 *     downgrade sheet applies);
 *   · plus `ULTRA_ADDON_GIVES.people` for each Ultra Add-on live NOW, on a plan that holds bought extras (Ultra).
 * ⚠ This is about what a shop HOLDS, never `canBuyExtraSeats` (which is false on every plan): the pause job used the
 * buy rule, so it would have locked out seats an Ultra shop pays for. Pure.
 */
export function extraPeopleHeld(
  tier: string | null | undefined,
  extraAgentSeats: number | null | undefined,
  liveUltraAddOns: number | null | undefined,
): number {
  const seats = holdsExtraSeats(tier) ? extraSeatsFromPaidCount(extraAgentSeats) : 0;
  const packs = holdsBoughtExtras(tier) ? extraSeatsFromPaidCount(liveUltraAddOns) : 0;
  return seats + packs * ULTRA_ADDON_GIVES.people;
}

/** What a shop holds on top of its plan's people — MEASURED, or that it could not be read. Never a 0 for "unread". */
export type ExtraPeopleRead = { status: 'ok'; extra: number } | { status: 'unread' };

/**
 * 🔑 HONEST READ of {@link extraPeopleHeld} for one shop on `tier`: its stored single seats and, on a plan that holds
 * bought extras, the live Ultra Add-on count (`vendor_live_ultra_addons_for`). Any refused, thrown or malformed
 * answer is `unread` — the Team page then says it couldn't load and the invite gate refuses with "try again", instead
 * of drawing (or enforcing) a cap that leaves out people the shop paid for.
 */
export async function readExtraPeople(
  supabase: SupabaseClient,
  vendorProfileId: string,
  tier: string | null | undefined,
): Promise<ExtraPeopleRead> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('extra_agent_seats')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) {
      console.error('[supabase-error] vendor-seats: extra seats unread', error ?? 'no row');
      return { status: 'unread' };
    }
    const seats = (data as { extra_agent_seats?: number | null }).extra_agent_seats;
    if (!holdsBoughtExtras(tier)) return { status: 'ok', extra: extraPeopleHeld(tier, seats, 0) };
    const live = await supabase.rpc('vendor_live_ultra_addons_for', { p_vendor_profile_id: vendorProfileId });
    const packs = typeof live.data === 'number' ? live.data : typeof live.data === 'string' ? Number(live.data) : NaN;
    if (live.error || !Number.isFinite(packs) || packs < 0) {
      console.error('[supabase-error] vendor-seats: live Ultra Add-ons unread', live.error ?? live.data);
      return { status: 'unread' };
    }
    return { status: 'ok', extra: extraPeopleHeld(tier, seats, packs) };
  } catch (e) {
    console.error('[supabase-error] vendor-seats: extra people read threw', e);
    return { status: 'unread' };
  }
}

/**
 * The STORED single extra seats of a shop (`extra_agent_seats`), raw — a fact for the downgrade sheet, which applies
 * `holdsExtraSeats` to each plan it weighs. Soft: any read failure yields 0. ⚠ Not a cap: what a shop holds on its
 * plan, with its Ultra Add-ons, is {@link readExtraPeople}.
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
    return extraSeatsFromPaidCount((data as { extra_agent_seats?: number | null }).extra_agent_seats);
  } catch {
    return 0;
  }
}

/**
 * The live extra-seat fee (PHP) from the admin-managed catalog — or null when the row is missing, inactive,
 * unpriced or unreadable. Null means "no figure on screen, no sale", never a remembered price.
 */
export async function fetchSeatFeePhp(supabase: SupabaseClient): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('price_php')
      .eq('sku_code', SEAT_SKU_CODE)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] vendor-seats: seat fee unread', error);
      return null;
    }
    if (!data) return null;
    const price = Number((data as { price_php: number | string }).price_php);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
