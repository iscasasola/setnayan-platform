/**
 * two-admin-promise.ts — what `/help` promises needs two admins, and what the
 * code actually gates.
 *
 * ── The finding (2026-09-22) ────────────────────────────────────────────────
 * `/help` publishes, live, under "What needs two-admin approval":
 *
 *   "Per Vendor Agreement § 9.1: major decisions need two admins. That means
 *    ad-revenue activation, vendor verification override, a large refund above
 *    the policy threshold, force-majeure bulk resolution, payment-method config
 *    change, and any blanket policy update."
 *
 * That is a **contractual commitment to suppliers**, citing a numbered clause.
 *
 * 🔑 THE FOUR-EYES MECHANISM IS REAL AND GATES A DIFFERENT SET. Production's
 * `admin_approval_requests` CHECK allows `grant_internal_account`,
 * `grant_team_pool`, `promote_to_admin`, `approve_vendor_partnership`,
 * `approve_fraud_wipe_ban`, `approve_journal_spotlight` — and, since this
 * session, `approve_comp_grant`. **Not one of the six the page promises.**
 *
 * So the control exists, works, is enforced in the database
 * (`admin_approval_four_eyes`: `decided_by <> initiated_by`) — and is pointed
 * somewhere other than where the contract says it points.
 *
 * ── What this module is FOR, and what it is not ─────────────────────────────
 * It is not a fix. Implementing six approval flows is a body of work, and the
 * refund one cannot even be specified here: the page says "above the policy
 * threshold" and "the exact refund threshold is set in the Vendor Agreement" —
 * a number that lives in a contract, not in this repo.
 *
 * ⛔ AND THAT NUMBER MUST NOT BE GUESSED. Owner ruling, 2026-08-31, on a
 * different invented default: *"don't guess."* A threshold that decides which
 * refunds need a second pair of eyes governs money and is quoted in an
 * agreement; picking one here and labelling it a guess would be the same
 * mistake with a comment attached.
 *
 * So this records the gap where the next session reads it, and the guard beside
 * it stops the promise and the code drifting further apart in silence.
 */

/** An action the published help page says requires two admins. */
export type TwoAdminPromise = {
  /** Short key, for the guard and for talking about it. */
  key: string;
  /** The words on the page, so a copy change is detectable. */
  asPublished: string;
  /**
   * The `admin_approval_requests.action_type` that implements it, or `null`
   * when nothing does. `null` is a statement of fact, not a TODO: the page
   * promises it today, to suppliers, under a contract clause.
   */
  actionType: string | null;
  /** Why it is not implemented, or what implementing it would need. */
  note: string;
};

export const TWO_ADMIN_PROMISES: readonly TwoAdminPromise[] = [
  {
    key: 'ad-revenue-activation',
    asPublished: 'ad-revenue activation',
    actionType: null,
    note: 'Paid placement going live on the public marketplace. No approval type exists; the admin boost dial writes directly.',
  },
  {
    key: 'vendor-verification-override',
    asPublished: 'vendor verification override',
    actionType: null,
    note: 'Granting the verified badge against the paper check. Register SUP-29 separately asks that Approve switch from WARN to REFUSE once real outside suppliers apply.',
  },
  {
    key: 'large-refund',
    asPublished: 'a large refund above the policy threshold',
    actionType: null,
    note: '⛔ CANNOT BE SPECIFIED HERE. The page itself says "the exact refund threshold is set in the Vendor Agreement" — the number lives in a contract, not this repo. `refundOrder` today accepts any amount up to a ₱100M paste-typo guard, from one admin. Implementing this needs the owner to state the threshold first.',
  },
  {
    key: 'force-majeure-bulk-resolution',
    asPublished: 'force-majeure bulk resolution',
    actionType: null,
    note: 'Resolving many affected bookings at once. `app/admin/force-majeure/actions.ts` requires notes for refund/partial-credit but no second admin.',
  },
  {
    key: 'payment-method-config-change',
    asPublished: 'payment-method config change',
    actionType: null,
    note: 'Changing where money arrives. Arguably the highest-consequence item on the list, since it redirects funds rather than moving a single amount.',
  },
  {
    key: 'blanket-policy-update',
    asPublished: 'any blanket policy update',
    actionType: null,
    note: 'Deliberately broad in the contract. Would need the owner to name which concrete admin screens it covers before it can be gated.',
  },
];

/** Promises with no mechanism behind them. */
export function unimplementedPromises(): readonly TwoAdminPromise[] {
  return TWO_ADMIN_PROMISES.filter((p) => p.actionType === null);
}
