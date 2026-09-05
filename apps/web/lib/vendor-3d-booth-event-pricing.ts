import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-3d-booth-event-pricing.ts — the ₱500 PER-EVENT 3D Booth branding.
 *
 * Owner 2026-09-05: "500 per event. or 3000/4 week cycle." A vendor can brand
 * their booth in ONE couple's published 3D Plan for a one-time fee, instead of
 * (or as well as) the 28-day cycle that brands it in every client's room
 * (`lib/vendor-3d-booth-pricing.ts`). Same floor as the cycle, owner verbatim:
 * "unverified vendors cannot purchase here and free. only paid vendors (solo,
 * pro and enterprise)".
 *
 * ── THE GRANT IS THE ORDER ROW ──────────────────────────────────────────────
 * No new table, no new column: `orders` already carries vendor_profile_id +
 * event_id + service_key + status. A paid/fulfilled row for this SKU on
 * (vendor, event) IS the entitlement. It has NO clock — the booth stays branded
 * for as long as the couple keeps the room up. "Per event" means the event, not
 * 28 days that could lapse the morning of the wedding.
 *
 * The cycle works differently and that is fine: its paid renewal is stamped
 * onto vendor_profiles.booth_addon_expires_at by `lib/sku-activation.ts`
 * (`activateVendor3dBoothOrder`, keyed by SKU) when the admin approves the
 * order. This SKU needs NO activation entry — the approved order row already
 * answers the only question anyone asks of it — and the activation map treats
 * an unmapped SKU as "no side effect", so approval stays a plain status flip.
 * (A first draft of this paragraph claimed the cycle was never stamped at all;
 * that was a too-narrow grep of app/admin, not a fact. Measured, corrected.)
 *
 * ── ONE FALLBACK, ONE SKU CODE, THIS FILE ───────────────────────────────────
 * `fallback-prices-match-the-catalog.db.test.ts` pairs a file's single
 * `*_FALLBACK_PHP` with its single `*_SKU_CODE` and holds the constant to the
 * live catalogue row. That is why this SKU lives in its own module and not
 * beside the cycle's: two of each in one file and the pairing has nothing to
 * pair.
 *
 * PURE decision + client-as-argument reads (no server-only import), the
 * vendor-3d-booth-pricing.ts discipline.
 */

/** Catalogue sku_code AND the literal `orders.service_key`. Seeded by
 *  migration 20271205905484 as `vendor_addon_per_event`. */
export const VENDOR_3D_BOOTH_EVENT_SKU_CODE = 'vendor_3d_booth_event';

/**
 * Last-resort price when the catalogue row is missing/unreadable. ⛔ A SECOND
 * COPY OF A CATALOGUE PRICE — moves in the same change as the row, and the db
 * test above holds it there.
 */
export const VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP = 500;

/** The SECURITY DEFINER read of "who is branded here" (migration 20271205905484). */
export const EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC = 'event_branded_booth_vendor_ids';

/** Order statuses that count as a live per-event grant — the same two
 *  `lib/entitlements.ts` ACTIVE_STATUSES treats as an unlocked feature. */
export const BOOTH_EVENT_ACTIVE_STATUSES: ReadonlySet<string> = new Set(['paid', 'fulfilled']);
/** A submitted order awaiting the admin's payment check. */
export const BOOTH_EVENT_PENDING_STATUSES: ReadonlySet<string> = new Set(['submitted']);

/**
 * THE per-event branding decision. Pure. A booth brands at an event when EITHER
 * the vendor's 28-day cycle is live OR they hold a paid per-event order here.
 * Both halves feed `lib/seating-3d.ts boothIsBranded` through the ONE
 * `boothAddonActive` boolean, so the logo, the poster and the crowd-avoidance
 * disc can never disagree about it.
 */
export function boothBrandedAtEvent(input: { cycleActive: boolean; eventOrderActive: boolean }): boolean {
  return input.cycleActive === true || input.eventOrderActive === true;
}

export type BoothEventOrderState = 'none' | 'pending' | 'active';

/** Pure: collapse a vendor's per-event order rows on one event to one state.
 *  `active` wins over `pending` (a re-submitted order beside an approved one
 *  must not read as "under review"). */
export function boothEventOrderState(statuses: readonly (string | null | undefined)[]): BoothEventOrderState {
  let pending = false;
  for (const s of statuses) {
    const v = s ?? '';
    if (BOOTH_EVENT_ACTIVE_STATUSES.has(v)) return 'active';
    if (BOOTH_EVENT_PENDING_STATUSES.has(v)) pending = true;
  }
  return pending ? 'pending' : 'none';
}

function coercePrice(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** The live ₱500 from the admin-managed catalogue; fallback when missing.
 *  Returns null when the row exists but is RETIRED (is_active = false) — the
 *  caller must refuse the sale, never quote the fallback for a product that
 *  is off sale. */
export async function fetchVendor3dBoothEventPricePhp(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_3D_BOOTH_EVENT_SKU_CODE)
    .maybeSingle();
  const row = data as { price_php?: number | string | null; is_active?: boolean | null } | null;
  if (row && row.is_active === false) return null;
  return coercePrice(row?.price_php, VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP);
}

/**
 * Which vendors hold a PAID per-event branding on this event. Goes through the
 * SECURITY DEFINER RPC, never a direct `orders` read: `orders_owner_read` is
 * `user_id = auth.uid()`, so the couple's own session could not see a vendor's
 * order and their lab would draw a generic booth while the public walk drew
 * the branded one.
 *
 * ⚠ PASS THE ADMIN CLIENT. The RPC is granted to service_role ONLY (the
 * vendor_papic_challenge_entitled precedent; the exposure-freeze guard refused
 * an `authenticated` grant). A session client gets 42501 here, which this
 * function turns into an EMPTY set — logged, never silent — and an empty set
 * renders exactly like "nobody paid". `fetchBooths` therefore takes a
 * `brandedReader`, and `brand-your-booth-at-one-wedding.test.ts` pins that every
 * session-client caller hands it the admin client.
 */
export async function fetchEventBrandedBoothVendorIds(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc(EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC, {
    p_event_id: eventId,
  });
  if (error) {
    console.error(
      `[3d-booth] ${EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC} refused for event ${eventId}: ${error.message} — per-event branding will render as absent`,
    );
    return new Set();
  }
  const ids = (data ?? []) as unknown;
  if (!Array.isArray(ids)) return new Set();
  return new Set(
    ids
      .map((r) => (typeof r === 'string' ? r : (r as { event_branded_booth_vendor_ids?: string })?.event_branded_booth_vendor_ids))
      .filter((v): v is string => typeof v === 'string' && v.length > 0),
  );
}

/** One vendor's per-event order state on one event — for the vendor's own
 *  client page. Reads `orders` with the caller's client: the VENDOR is the
 *  order's `user_id`… except when a teammate minted it, so callers pass the
 *  ADMIN client (the section is a server component). */
export async function fetchVendorBoothEventOrderState(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<BoothEventOrderState> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('event_id', eventId)
    .eq('service_key', VENDOR_3D_BOOTH_EVENT_SKU_CODE);
  if (error) return 'none';
  return boothEventOrderState(((data ?? []) as { status: string | null }[]).map((r) => r.status));
}
