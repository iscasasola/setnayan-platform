import type { SupabaseClient } from '@supabase/supabase-js';
import { isVendor3dBoothActive } from './vendor-3d-booth-pricing';

/**
 * vendor-3d-plan-unlock.ts — the VENDOR-ENABLED COUPLE DISCOUNT on the 3D Plan.
 *
 * Owner-locked 2026-07-22: a booked vendor with an ACTIVE paid 3D Booth add-on
 * (₱1,500/28d · lib/vendor-3d-booth-pricing.ts isVendor3dBoothActive) can UNLOCK
 * the 3D Plan upgrade for a couple they are booked with — unlimited times. The
 * unlock does NOT gift SEATING_3D for free: it marks the event ELIGIBLE for a
 * DISCOUNTED ₱1,000 SEATING_3D (vs the standard ₱2,999 catalog price). The COUPLE
 * then buys SEATING_3D through the normal apply-then-pay checkout, and the
 * server-authoritative price resolver (lib/v2-catalog.ts
 * resolvePaxPricedOrderCentavos) reads the unlock record here and charges ₱1,000.
 * Both sides pay; the couple keeps full control of what they publish.
 *
 * This is NOT a parallel entitlement — it confers no free access and never feeds
 * eventSkuActive(). It is purely a per-event discount-eligibility + attribution
 * record (table event_vendor_3d_plan_unlocks · migration 20270909783681). The
 * couple's SEATING_3D OWNERSHIP still flows through the one existing orders path.
 *
 * The eligibility GATE + the price SELECTOR are PURE functions (no I/O, no clock)
 * so the vendor action (server) and the client card share one source of truth and
 * everything is unit-testable under `tsx --test`. The DB readers take their
 * Supabase client as an argument so this module has no server-only import.
 * Mirrors lib/vendor-photo-challenge.ts.
 */

/**
 * The couple SKU being discounted. The vendor unlock changes ONLY this SKU's
 * price for the event; the couple still purchases under this same service_key.
 */
export const VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY = 'SEATING_3D';

/** The per-event unlock table (migration 20270909783681). */
export const VENDOR_3D_PLAN_UNLOCK_TABLE = 'event_vendor_3d_plan_unlocks';

/**
 * "Booked" = a contracted-or-further event_vendors row. The single source shared
 * by the unlock action's booked-gate AND the charge-time re-validation, so the
 * two can never drift (a vendor whose booking is what unlocked the discount is
 * re-checked against the SAME status set when the couple actually pays).
 */
export const VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

/**
 * Owner-locked 2026-07-22: the DISCOUNTED price (PHP) a couple pays for the 3D
 * Plan when a booked vendor with an active 3D Booth add-on has unlocked it — vs
 * the standard catalog SEATING_3D price (₱2,999, admin-managed in
 * platform_retail_catalog_v2). This is the SINGLE documented source for the
 * discount; the authoritative charge resolver and any UI copy read it here, so a
 * magic ₱1,000 literal is never scattered across the codebase. If the owner later
 * wants the discount admin-tunable, promote this to a platform_settings column
 * with THIS constant as the fallback — no call site changes.
 */
export const VENDOR_3D_PLAN_UNLOCK_PRICE_PHP = 1000;

/** The discounted price in CENTAVOS (the order-charge unit · integer). */
export function vendor3dPlanUnlockPriceCentavos(): number {
  return Math.round(VENDOR_3D_PLAN_UNLOCK_PRICE_PHP * 100);
}

// ── Eligibility gate (vendor side) ───────────────────────────────────────────

export type Vendor3dPlanUnlockDenyReason =
  /** The vendor has no ACTIVE 3D Booth add-on — the add-on IS the entitlement. */
  | 'no_addon'
  /** The vendor is not booked on this event (event_vendors, contracted+). */
  | 'not_booked'
  /** This event's 3D Plan discount was already unlocked — no-op. */
  | 'already_unlocked';

export type Vendor3dPlanUnlockEligibilityInput = {
  /** Is the vendor's 3D Booth add-on currently active (isVendor3dBoothActive)? */
  boothAddonActive: boolean;
  /** Does this vendor own a BOOKED event_vendors row on the event? */
  booked: boolean;
  /** Does an event_vendor_3d_plan_unlocks row already exist for the event? */
  alreadyUnlocked: boolean;
};

export type Vendor3dPlanUnlockEligibility =
  | { ok: true }
  | { ok: false; reason: Vendor3dPlanUnlockDenyReason };

/**
 * THE eligibility decision — pure, so the unlock action (server) and the client
 * card share one source of truth. Checked in the same order the action rejects,
 * so the surfaced reason always matches what a submit would return:
 * active add-on → booked → not-already-unlocked.
 *
 * NOTE: there is no separate tier/verification gate — the 3D Booth add-on is
 * ONLY sellable to verified Pro/Enterprise/Custom vendors, so an ACTIVE add-on
 * already implies a paid, verified shop. Gating on `boothAddonActive` is the
 * required "requires the active 3D Booth add-on" check, not a proxy for it.
 */
export function vendor3dPlanUnlockEligibility(
  input: Vendor3dPlanUnlockEligibilityInput,
): Vendor3dPlanUnlockEligibility {
  if (!input.boothAddonActive) return { ok: false, reason: 'no_addon' };
  if (!input.booked) return { ok: false, reason: 'not_booked' };
  if (input.alreadyUnlocked) return { ok: false, reason: 'already_unlocked' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the vendor UI). */
export const VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE: Record<
  Vendor3dPlanUnlockDenyReason,
  string
> = {
  no_addon:
    'The 3D Plan unlock is included with the 3D Booth add-on. Add the 3D Booth add-on to unlock the discounted 3D Plan for your couples.',
  not_booked:
    'You can only unlock the 3D Plan for a couple you’re booked with.',
  already_unlocked:
    'You’ve already unlocked the discounted 3D Plan for this couple — they can add it from their dashboard.',
};

// ── Price selector (couple side · server-authoritative) ──────────────────────

/**
 * Given the STANDARD SEATING_3D charge (centavos) and whether this event has been
 * vendor-unlocked, return the charge the couple actually owes. PURE — this is the
 * server-authoritative discount, unit-tested exhaustively.
 *
 * Guards:
 *   • only applies to SEATING_3D (any other serviceCode passes through unchanged);
 *   • only when the event is unlocked;
 *   • only ever LOWERS the price (Math.min) — a standard price already at/below
 *     the discount is never raised.
 */
export function applyVendor3dPlanUnlockDiscountCentavos(
  serviceCode: string,
  standardCentavos: number,
  isUnlocked: boolean,
  discountPhp: number = VENDOR_3D_PLAN_UNLOCK_PRICE_PHP,
): number {
  if (serviceCode !== VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY || !isUnlocked) {
    return standardCentavos;
  }
  const discountCentavos = Math.round(discountPhp * 100);
  return Math.min(standardCentavos, discountCentavos);
}

// ── DB readers (client passed in — no server-only import) ────────────────────

export type EventVendor3dPlanUnlock = {
  vendorProfileId: string;
  unlockedAt: string | null;
};

/**
 * The unlock record for an event (or null). Soft: any error / missing table
 * degrades to `null` (not unlocked) so a pre-migration DB never crashes a caller.
 * Pass an ADMIN client when the caller isn't the couple/vendor whose RLS admits
 * the row (e.g. the checkout price resolver, which runs server-side).
 */
export async function fetchEventVendor3dPlanUnlock(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventVendor3dPlanUnlock | null> {
  try {
    const { data, error } = await supabase
      .from(VENDOR_3D_PLAN_UNLOCK_TABLE)
      .select('vendor_profile_id, unlocked_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { vendor_profile_id: string; unlocked_at: string | null };
    return { vendorProfileId: row.vendor_profile_id, unlockedAt: row.unlocked_at ?? null };
  } catch {
    return null;
  }
}

/**
 * Has this event's 3D Plan discount been unlocked by a booked vendor? The boolean
 * the VENDOR-side surfaces (the unlock action's idempotency check + the "you've
 * unlocked this" card) consult — it answers only "does an unlock ROW exist",
 * NOT "is the discount still honored at charge time" (that is
 * {@link eventVendor3dPlanUnlockDiscountActive}). Soft-degrades to `false` on any
 * error / missing table (a pre-migration DB never mis-prices — the couple just
 * pays the standard price). Pass an ADMIN client on server surfaces.
 */
export async function eventHasVendor3dPlanUnlock(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return (await fetchEventVendor3dPlanUnlock(supabase, eventId)) != null;
}

// ── Charge-time re-validation (money integrity) ──────────────────────────────

export type Vendor3dPlanUnlockRevalidationInput = {
  /** Does an unlock record exist for the event at all? */
  hasUnlock: boolean;
  /** Is the ATTRIBUTING vendor's 3D Booth add-on STILL active (not lapsed)? */
  boothAddonActive: boolean;
  /** Is the ATTRIBUTING vendor STILL booked on the event (contracted+)? */
  stillBooked: boolean;
};

/**
 * THE charge-time decision — pure, so it is exhaustively unit-tested. The ₱1,000
 * discount is honored ONLY while the unlock still stands on its own terms: the
 * record exists AND the vendor who unlocked it still has a live 3D Booth add-on
 * AND is still booked on the event. A lapsed booth, an un-booked / cancelled
 * vendor, or a missing record all fall back to the STANDARD price — the discount
 * is a live entitlement, not a one-way latch stamped once and honored forever.
 */
export function vendor3dPlanUnlockDiscountHonored(
  input: Vendor3dPlanUnlockRevalidationInput,
): boolean {
  return input.hasUnlock && input.boothAddonActive && input.stillBooked;
}

/**
 * Is the ₱1,000 discount STILL valid for this event AT CHARGE TIME? The boolean
 * the server-authoritative price resolver consults (lib/v2-catalog.ts
 * resolvePaxPricedOrderCentavos). Unlike {@link eventHasVendor3dPlanUnlock} (which
 * only checks a row exists), this RE-VALIDATES the attributing vendor: it re-reads
 * their 3D Booth add-on window (isVendor3dBoothActive) and re-confirms their
 * contracted-or-further event_vendors booking. So a vendor whose booth lapsed, or
 * who is no longer booked / cancelled, no longer yields the couple ₱1,000 — the
 * couple pays the standard price instead.
 *
 * FAIL-SAFE: any read error degrades to `false` (standard price) — a transient
 * fault must NEVER hand out the discount to a vendor who no longer qualifies. Pass
 * an ADMIN client (the resolver runs server-side; the couple's RLS can't see the
 * vendor's add-on window or their event_vendors booking row).
 */
export async function eventVendor3dPlanUnlockDiscountActive(
  supabase: SupabaseClient,
  eventId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const unlock = await fetchEventVendor3dPlanUnlock(supabase, eventId);
  if (!unlock) return false;
  try {
    // (1) The attributing vendor's 3D Booth add-on must still be active.
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('booth_addon_expires_at')
      .eq('vendor_profile_id', unlock.vendorProfileId)
      .maybeSingle();
    const boothAddonActive = isVendor3dBoothActive(
      (vp as { booth_addon_expires_at?: string | null } | null)?.booth_addon_expires_at ?? null,
      nowMs,
    );

    // (2) The attributing vendor must still be booked on THIS event.
    const { data: bookedRow } = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', unlock.vendorProfileId)
      .in('status', VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES as unknown as string[])
      .limit(1)
      .maybeSingle();
    const stillBooked = bookedRow != null;

    return vendor3dPlanUnlockDiscountHonored({
      hasUnlock: true,
      boothAddonActive,
      stillBooked,
    });
  } catch {
    // Fail toward the STANDARD price — never toward a discount for a vendor who
    // may no longer qualify.
    return false;
  }
}
