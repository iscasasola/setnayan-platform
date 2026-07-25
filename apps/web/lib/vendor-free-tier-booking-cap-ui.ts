/**
 * vendor-free-tier-booking-cap-ui.ts — the couple-facing "Fully booked" layer
 * for the free-tier concurrent-booking cap (owner-locked 2026-07-25; see
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 4 "Free-tier mechanics").
 *
 * WHAT THIS IS FOR. The cap itself already exists in two places:
 *   • pure decision logic — `vendor-free-tier-booking-cap.ts`
 *   • the hard DB guard  — migration 20271001120000
 *     (`enforce_free_tier_booking_cap`, gated on
 *      `platform_settings.free_tier_booking_cap_enabled`, default FALSE)
 * What was MISSING — and what blocks flipping either switch — is the couple's
 * side of it: at the cap the trigger raises a RAW Postgres `check_violation`,
 * which today would surface to a couple as a database sentence in a red toast.
 * This module supplies (a) the ONE detector that recognises that error and
 * (b) the ONE set of honest copy strings every Lock/Book surface renders, so
 * the couple sees "Fully booked" instead of a stack of SQL.
 *
 * MODEL BOUNDARY (do not widen): at the cap a vendor stays DISCOVERABLE and
 * their INBOX + CHAT stay fully open — a capped vendor still receives inquiries,
 * chats, and sends proposals (this is the prime upsell moment). ONLY the
 * couple's Lock/Book action is gated. Nothing in this file touches messaging.
 *
 * PURE: no I/O, no clock, no env — so it runs under `tsx --test`. The env flag
 * that switches the surfaces onto it lives in
 * `vendor-free-tier-booking-cap-ui-flag.ts`; the server-side read lives in
 * `vendor-free-tier-booking-cap.server.ts`.
 */

/**
 * The stable token the DB trigger puts in its exception message
 * (`RAISE EXCEPTION 'free_tier_booking_cap: …'`). Matching on the token rather
 * than the whole sentence keeps the detector stable if the wording changes, and
 * keeps it narrow enough that no other check_violation can be mistaken for it.
 */
export const FREE_TIER_BOOKING_CAP_ERROR_TOKEN = 'free_tier_booking_cap';

/** Postgres `check_violation` — the SQLSTATE the trigger raises with. */
export const FREE_TIER_BOOKING_CAP_ERROR_CODE = '23514';

/** The shape a PostgREST / supabase-js error arrives in (all fields optional). */
export type MaybePostgrestError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

/**
 * True when this error is the free-tier booking cap firing. Checks the token
 * across message/details/hint (supabase-js surfaces the RAISE text in
 * `message`, PostgREST sometimes moves it to `details`, and the trigger's HINT
 * carries the upsell line). The SQLSTATE is deliberately NOT required: an RPC
 * that re-raises can lose the code but never the token, and requiring both
 * would let a raw DB sentence leak on the path we most want covered.
 */
export function isFreeTierBookingCapError(err: MaybePostgrestError): boolean {
  if (!err) return false;
  const haystack = [err.message, err.details, err.hint]
    .filter((s): s is string => typeof s === 'string')
    .join(' ');
  return haystack.includes(FREE_TIER_BOOKING_CAP_ERROR_TOKEN);
}

// ---------------------------------------------------------------------------
// Copy — one source, every surface
// ---------------------------------------------------------------------------

/** The badge / disabled-CTA label. Kept short enough for a button. */
export const VENDOR_FULLY_BOOKED_BADGE_LABEL = 'Fully booked';

/**
 * The couple-facing explanation. Honest about WHY (the vendor is at capacity),
 * never leaks the vendor's plan/tier (a couple has no business seeing that a
 * vendor is on the free plan), and points at what the couple can actually do
 * next: keep talking to them, or pick someone else.
 */
export const VENDOR_FULLY_BOOKED_COUPLE_MESSAGE =
  'This vendor is fully booked right now and can’t take another booking yet. ' +
  'You can still message them — a slot opens up when one of their events wraps.';

/** Same message, personalised when the surface knows the vendor's name. */
export function vendorFullyBookedCoupleMessage(
  vendorName?: string | null,
): string {
  const name = typeof vendorName === 'string' ? vendorName.trim() : '';
  if (name.length === 0) return VENDOR_FULLY_BOOKED_COUPLE_MESSAGE;
  return (
    `${name} is fully booked right now and can’t take another booking yet. ` +
    'You can still message them — a slot opens up when one of their events wraps.'
  );
}

/**
 * The couple-facing refusal when the couple ALSO submitted a downpayment with
 * this lock attempt — the narrow race where the vendor's last slot was taken
 * between the pre-check and the write.
 *
 * The lock did not commit, so nothing was recorded: no booking, no ledger row.
 * Setnayan never holds this money (downpayments are paid to the vendor directly
 * and only LOGGED here), so the honest thing — and the only thing — is to say
 * plainly that it was not recorded and point at the thread. Never imply a
 * booking, a hold, or a refund we cannot make.
 */
export function vendorFullyBookedDepositNotRecordedMessage(
  vendorName?: string | null,
): string {
  const name = typeof vendorName === 'string' ? vendorName.trim() : '';
  const who = name.length === 0 ? 'This vendor' : name;
  return (
    `${who} took their last booking slot moments ago, so this lock did not go through — ` +
    'and your downpayment was NOT recorded. Nothing is booked and nothing is held. ' +
    'If you already sent money, message them in your thread to sort it out.'
  );
}

/**
 * Shape the couple-facing payload for a cap refusal raised AT A WRITE SITE.
 *
 * `depositSubmitted` is the whole point. When the couple sent a downpayment
 * with this attempt, the lock did not commit, so the deposit-persist block
 * (marker stamp → `event_vendor_payments` row → vendor notification) never
 * runs. That is correct — there is no booking to hang a payment on — but it must
 * not be SILENT, which is exactly the "money out, no booking, no ledger row"
 * defect. Callers render `depositNotRecordedMessage` when present.
 */
export function fullyBookedRefusalPayload(opts: {
  vendorName: string;
  depositSubmitted: boolean;
}): { vendorName: string; depositNotRecordedMessage?: string } {
  if (!opts.depositSubmitted) return { vendorName: opts.vendorName };
  return {
    vendorName: opts.vendorName,
    depositNotRecordedMessage: vendorFullyBookedDepositNotRecordedMessage(
      opts.vendorName,
    ),
  };
}

/**
 * How many CONCURRENT bookings do these rows represent? One booking = one
 * EVENT, never one row: a couple who books a vendor for four services in one
 * event has bought ONE slot, not four (`event_vendors` carries a row per
 * service). Counting rows let a single 4-item package exhaust a free vendor's
 * entire allowance for every other couple.
 *
 * Blank / non-string ids are ignored rather than collapsed into one bucket.
 */
export function countDistinctBookedEvents(
  eventIds: ReadonlyArray<string | null | undefined>,
): number {
  const seen = new Set<string>();
  for (const id of eventIds) {
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (trimmed.length === 0) continue;
    seen.add(trimmed);
  }
  return seen.size;
}

/**
 * The vendor-side upsell line. NOT shown to couples — it exists here so the
 * vendor dashboard reads the same words the cap enforces. (Wiring it into the
 * vendor dashboard is a separate track; this constant is the contract.)
 */
export const VENDOR_FULLY_BOOKED_VENDOR_UPSELL =
  'You’re holding the 3 concurrent bookings the free plan allows. ' +
  'Finish an event to free a slot, or subscribe for unlimited bookings.';

/**
 * The couple-facing Lock/Book CTA label + disabled state for a vendor at the
 * cap. `fullyBooked` is the ONLY input — deliberately: a surface must not be
 * able to render "Fully booked" for any other reason (an unverified vendor, a
 * paused service, a hard-single conflict all have their own copy).
 */
export function lockCtaStateForCap(fullyBooked: boolean): {
  disabled: boolean;
  label: string | null;
} {
  return fullyBooked
    ? { disabled: true, label: VENDOR_FULLY_BOOKED_BADGE_LABEL }
    : { disabled: false, label: null };
}
