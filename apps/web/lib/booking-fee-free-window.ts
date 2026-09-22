/**
 * booking-fee-free-window.ts — is a free-fee promotion running right now?
 *
 * ─── THE RULE LIVES IN SQL; THIS IS ITS READABLE TWIN ────────────────────
 * The money decision is made by `public.booking_fee_free_window_active()`,
 * inside the three SECURITY DEFINER functions that mint a charge. That is the
 * only copy that can waive a peso, and it is deliberately NOT called from here:
 * it is not SECURITY DEFINER, so an `authenticated` caller would be refused the
 * `platform_settings` row by RLS and get a silent, confident FALSE.
 *
 * So the server resolver reads the two columns with the admin client it already
 * holds and asks THIS function, which is pure and therefore executable by a
 * guard. Two implementations of one rule is the failure mode this repo keeps
 * paying for, so `a-free-fee-window-waives-the-charge.db.test.ts` runs the SQL
 * function and this function over the SAME table of cases and fails if they
 * ever disagree. The parity test is what makes the twin safe.
 *
 * ─── WHAT THE WINDOW IS FOR ──────────────────────────────────────────────
 * Owner, 2026-09-22, on the day the booking-fee lock went live: *"if we make
 * booking fee for free for a specific time … they can access what the booking
 * fee locks."* Before this existed, declaring a free period would still have
 * minted `pending` charges at full price — and, with the lock on, shut those
 * suppliers out of weddings they were about to work.
 */

/** The two bounds, exactly as `platform_settings` stores them. */
export type BookingFeeFreeWindow = {
  /** ISO timestamp, or null for an open-ended start. */
  from: string | null;
  /** ISO timestamp, or null for an open-ended end. */
  until: string | null;
};

/**
 * Is the window open at `at`?
 *
 * 🔑 IT FAILS CLOSED, AND BOTH HALVES OF THAT MATTER.
 *   · BOTH bounds null = NO window. Not "free forever" — an unset promotion and
 *     an eternal one must never be the same state, and the unset one is the
 *     default every deployment starts in.
 *   · An UNPARSEABLE bound = no window. A typo in a date must not hand every
 *     supplier a free booking; it must do nothing and be noticed.
 *
 * One bound null WITH the other set is open-ended on that side, which is the
 * useful shape: setting only `until` means "free from now until then".
 *
 * Bounds are INCLUSIVE at both ends, matching the SQL (`>=` and `<=`).
 */
export function isBookingFeeFreeWindowActive(
  window: BookingFeeFreeWindow,
  at: Date,
): boolean {
  const { from, until } = window;
  if (from === null && until === null) return false;

  const now = at.getTime();
  if (!Number.isFinite(now)) return false;

  if (from !== null) {
    const start = Date.parse(from);
    if (Number.isNaN(start)) return false;
    if (now < start) return false;
  }
  if (until !== null) {
    const end = Date.parse(until);
    if (Number.isNaN(end)) return false;
    if (now > end) return false;
  }
  return true;
}

/**
 * "until 30 November" for the supplier-facing line, or null when the window has
 * no end.
 *
 * ⚠ MANILA, NOT THE SERVER'S ZONE. The server runs in UTC and every supplier
 * reading this is in the Philippines; formatting the instant in UTC shows the
 * wrong day to anyone reading after 8pm — the same defect the Today page's
 * greeting carried until 2026-09-10.
 */
export function freeWindowEndsLabel(until: string | null): string | null {
  if (!until) return null;
  const ms = Date.parse(until);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    day: 'numeric',
    month: 'long',
  });
}
