/**
 * verification-bypass.ts — the PURE core of "vouched for, with the paperwork owed".
 *
 * ── WHY IT EXISTS (owner, 2026-09-07) ───────────────────────────────────────
 * Real verification is four documents, a two-channel VALIDATE token and a
 * 15-minute Meet. Measured the day this shipped: **`vendor_verifications` held
 * ZERO rows** — nobody had ever completed it, both existing shops carried a
 * `verified` column written by a seed, and the marketplace consequently had no
 * inquiry in its entire history. So an admin may vouch for a supplier they
 * know, and that supplier lists immediately, owing documents by a deadline.
 *
 * ── TWO OWNER RULINGS THIS MODULE CANNOT SOFTEN ─────────────────────────────
 * • **Same badge.** Asked directly whether a couple should see any difference:
 *   *"just same."* So nothing here returns a public-facing label, and nothing
 *   here may be rendered to a couple. "Verified" now means *documents checked
 *   OR the platform vouched*, and only an admin can tell which.
 * • **No cap.** Asked whether to limit concurrent bypasses: *"no limit."* There
 *   is deliberately no counter and no ceiling in this file.
 *
 * 🔑 THE DEADLINE IS THEREFORE THE ONLY THING HOLDING THE BADGE HONEST. It is
 * enforced by expiry-on-read, not by anyone remembering — the same cron-free
 * shape Live Studio and Papic sessions use (owner-locked 2026-05-14).
 *
 * ── WHAT A MISSED DEADLINE COSTS (owner, 2026-09-11 · Q4 + Q5) ─────────────
 * The BADGE, not the listing. The shop stays findable and bookable; the badge
 * comes off because `vendor_profiles.next_renewal_due_at` (which a vouch now
 * writes as its deadline) has passed — see `lib/verified-badge.ts`. Until
 * 2026-09-11 this module said the listing would be withdrawn, and the sweep
 * that would have done it had no caller, so no shop was ever hidden by it.
 */

/** Six months, in days. The owner's figure. */
export const BYPASS_WINDOW_DAYS = 182;

/** Below this, the supplier's countdown starts shouting rather than informing. */
export const BYPASS_URGENT_DAYS = 30;

export type BypassFacts = {
  /** `verification_bypass_expires_at`, or null when the shop is not on a bypass. */
  expiresAt: string | null;
  /** TRUE once a real application has been approved — the bypass is then moot. */
  documentsApproved: boolean;
};

export type BypassState =
  /** Not vouched-for at all — either genuinely verified, or not verified. */
  | { kind: 'none' }
  /** Vouched-for, deadline still ahead. */
  | { kind: 'active'; daysLeft: number; urgent: boolean }
  /** Vouched-for and the documents landed — the deadline no longer applies. */
  | { kind: 'satisfied' }
  /** Deadline passed with no approved application. The badge is off; the shop stays listed. */
  | { kind: 'expired'; daysOverdue: number };

/**
 * Where a shop stands against its deadline.
 *
 * ⚠ `documentsApproved` WINS over the clock. A supplier who completed
 * verification during the window must never be marked lapsed because a stale
 * `expires_at` was left on the row — the bypass was a bridge, and they crossed
 * it. The sweep and the desk both read this, so they cannot disagree.
 */
export function bypassState(facts: BypassFacts, now: Date = new Date()): BypassState {
  if (facts.documentsApproved) return facts.expiresAt ? { kind: 'satisfied' } : { kind: 'none' };
  if (!facts.expiresAt) return { kind: 'none' };
  const expires = Date.parse(facts.expiresAt);
  // An unparseable timestamp must NOT read as "expired" — that would mark a
  // live vouch lapsed over a bad string. Absence of a usable date is absence of a
  // deadline, and the admin surface will show it as such.
  if (!Number.isFinite(expires)) return { kind: 'none' };
  const ms = expires - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (ms <= 0) return { kind: 'expired', daysOverdue: Math.max(0, -Math.floor(ms / 86_400_000)) };
  return { kind: 'active', daysLeft: days, urgent: days <= BYPASS_URGENT_DAYS };
}

/** The deadline a grant made today would carry. */
export function bypassExpiryFrom(grantedAt: Date, windowDays = BYPASS_WINDOW_DAYS): string {
  const d = new Date(grantedAt.getTime());
  d.setUTCDate(d.getUTCDate() + windowDays);
  return d.toISOString();
}

/**
 * TRUE when a vouch's window closed with no approved papers — the daily pass
 * then stamps the vouch row lapsed. It HIDES NOTHING: what a lapse costs is
 * the badge, and the badge reads its own deadline (`hasVerifiedBadge`).
 */
export function vouchHasLapsed(facts: BypassFacts, now: Date = new Date()): boolean {
  return bypassState(facts, now).kind === 'expired';
}

/**
 * What the SUPPLIER sees, from day one — never a surprise at day 175.
 * Returns null when there is nothing to say. Deliberately no couple-facing
 * variant exists: see the "same badge" ruling above.
 */
export function bypassNoticeForVendor(state: BypassState): string | null {
  switch (state.kind) {
    case 'active':
      return state.urgent
        ? `Your documents are due in ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'}. ` +
          'Send them before then and nothing changes; miss it and the Verified badge comes off ' +
          'your shop — it stays listed and bookable.'
        : `You are verified on Setnayan's word while your documents are pending — ` +
          `${state.daysLeft} days left to send them.`;
    case 'expired':
      return 'Your documents did not arrive in time, so the Verified badge is off your shop. ' +
        'Your shop is still listed and couples can still book you. Send them and the badge comes back.';
    case 'satisfied':
    case 'none':
      return null;
  }
}
