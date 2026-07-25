/**
 * vendor-free-tier-booking-cap.ts — the free-tier concurrent-active-booking cap
 * (owner-locked 2026-07-25; see `Vendor_Monetization_Model_LOCKED_2026-07-25.md`
 * § "Free-tier mechanics").
 *
 * A FREE vendor (tier below Solo — i.e. `free`/`verified`) may hold at most
 * THREE concurrent ACTIVE bookings (locked, event not yet complete). At the cap
 * they surface as "Fully booked": couples can no longer LOCK/book them until one
 * booking completes (a slot frees) or the vendor subscribes (Solo+ = unlimited).
 *
 * IMPORTANT: this cap gates ONLY the couple's Lock/Book action. Inbox and chat
 * are NEVER gated by it — a capped vendor still receives inquiries, chats, and
 * sends proposals (the prime upsell moment). That separation is enforced at the
 * wiring site, not here.
 *
 * PURE: no I/O, no clock, no env — just the cap constant + pure predicates, so
 * it unit-tests under `tsx --test`.
 *
 * WHETHER THE CAP IS ARMED IS A DB SWITCH, NOT AN ENV FLAG:
 * `platform_settings.free_tier_booking_cap_enabled` — the row the DB trigger
 * `enforce_free_tier_booking_cap` reads, and the row the server-side pre-check
 * in `vendor-free-tier-booking-cap.server.ts` reads. (An env stand-in,
 * `vendor-free-tier-booking-cap-flag.ts` / `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP`,
 * was DELETED 2026-07-26 with zero call sites: an env var cannot track a DB
 * column, and both directions of drift were real money defects.)
 * `vendor-free-tier-booking-cap-ui-flag.ts` gates only whether the couple-facing
 * LAYER exists, never whether a booking is refused.
 */
import { isTierAtLeast } from './vendor-tier-caps';

/** Max concurrent active (locked, not-yet-complete) bookings on the free tier. */
export const FREE_TIER_ACTIVE_BOOKING_CAP = 3;

/**
 * Does the free-tier booking cap apply to this tier? TRUE for the free tiers
 * (`free`/`verified` — below Solo); FALSE (unlimited) for Solo/Pro/Enterprise/
 * Custom. Reuses `isTierAtLeast` so there is one source of truth for the paid
 * boundary.
 */
export function freeTierBookingCapApplies(tier: string | null | undefined): boolean {
  return !isTierAtLeast(tier, 'solo');
}

/**
 * Remaining lockable slots for `tier` given its current active-booking count.
 * Returns `null` for a paid tier (unlimited). Never negative; a non-finite or
 * negative count is treated as 0 used.
 */
export function freeTierRemainingBookingSlots(
  tier: string | null | undefined,
  activeBookingCount: number,
): number | null {
  if (!freeTierBookingCapApplies(tier)) return null;
  const used = Number.isFinite(activeBookingCount)
    ? Math.max(0, Math.trunc(activeBookingCount))
    : 0;
  return Math.max(0, FREE_TIER_ACTIVE_BOOKING_CAP - used);
}

/**
 * Is this vendor AT the cap, so a NEW lock must be blocked ("Fully booked")?
 * Only a free tier can ever be capped; a paid tier is always `false`.
 * Server-authoritative callers re-read the vendor's own tier + a live count of
 * active bookings, so a tampered client can never force a lock past the cap.
 */
export function isAtFreeTierBookingCap(
  tier: string | null | undefined,
  activeBookingCount: number,
): boolean {
  const remaining = freeTierRemainingBookingSlots(tier, activeBookingCount);
  return remaining !== null && remaining <= 0;
}
