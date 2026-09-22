/**
 * two-admin-promise.ts — Vendor Agreement § 9.1, as one list both the help page
 * and the admin actions read.
 *
 * ── WHAT WAS WRONG (2026-09-22) ─────────────────────────────────────────────
 * `/help` published, live, under "What needs two-admin approval":
 *
 *   "Per Vendor Agreement § 9.1: major decisions need two admins. That means
 *    ad-revenue activation, vendor verification override, a large refund above
 *    the policy threshold, force-majeure bulk resolution, payment-method config
 *    change, and any blanket policy update. … The exact refund threshold is set
 *    in the Vendor Agreement."
 *
 * 🔑 **IT MISQUOTED THE CLAUSE IT CITED, IN BOTH DIRECTIONS.** § 9.1's major-
 * decisions table does not contain "ad-revenue activation", "force-majeure bulk
 * resolution" or "any blanket policy update" at all — those were invented. And
 * it OMITTED five things the clause does require, including the one number that
 * matters. § 9.1 is explicit:
 *
 *     | Refund any single transaction **> ₱25,000** | Financial control |
 *     | **Process a refund** ≤ ₱25,000 | Disputes Handler · Payments Handler |
 *
 * Worse, "vendor verification override" is listed by § 9.1 as the OPPOSITE —
 * "Approve a vendor verification queue item" is named there as single-admin
 * authority. The page told suppliers a routine action was double-checked.
 *
 * ⚠ **A CITATION IS NOT A QUOTATION.** The copy carried a clause number, which
 * is what made it credible and what stopped anyone opening the clause. The
 * number was never missing: it is in § 9.1, and it was also sitting in a
 * comment in `app/admin/payments/actions.ts` ("refunds > ₱25K"). A session
 * still escalated it to the owner as unknowable.
 *
 * ── WHAT THIS MODULE IS ─────────────────────────────────────────────────────
 * The § 9.1 table, transcribed, with the thresholds as constants. The help copy
 * is generated against it, `refundOrder` gates on it, and
 * `the-two-admin-promise-is-tracked.test.ts` fails if the page and this list
 * stop agreeing — in either direction.
 */

/**
 * § 9.1: "Refund any single transaction **> ₱25,000**" needs two admins;
 * "Process a refund ≤ ₱25,000" is single-admin. The boundary is single-admin,
 * so the comparison is strict.
 */
export const REFUND_TWO_ADMIN_THRESHOLD_PHP = 25_000;

/**
 * § 9.1: "Issue an `unlimited_use_grant` worth **> ₱10,000** retail to an
 * external customer" needs two admins; "Issue a comp gift worth ≤ ₱10,000
 * retail" is single-admin. Same strict boundary.
 */
export const COMP_TWO_ADMIN_THRESHOLD_PHP = 10_000;

/**
 * Does this refund need a second admin?
 *
 * 🔒 STRICT `>`, DELIBERATELY. A refund of exactly ₱25,000 is single-admin by
 * the contract. Making the boundary inclusive would be safer-feeling and would
 * still be a breach of what the vendor signed — in the direction of slowing the
 * Disputes Handler on an amount they were promised authority over.
 */
export function refundNeedsTwoAdmins(amountPhp: number): boolean {
  return amountPhp > REFUND_TWO_ADMIN_THRESHOLD_PHP;
}

/** Does this comp gift need a second admin? Same shape, § 9.1's other number. */
export function compNeedsTwoAdmins(retailPhp: number): boolean {
  return retailPhp > COMP_TWO_ADMIN_THRESHOLD_PHP;
}

/** A row of § 9.1's "major decisions" table. */
export type TwoAdminPromise = {
  /** Short key, for the guard and for talking about it. */
  key: string;
  /** The words on the help page, so a copy change is detectable. */
  asPublished: string;
  /** § 9.1's own "why two-admin" column, verbatim. */
  whyPerClause: string;
  /**
   * The `admin_approval_requests.action_type` that implements it, or `null`
   * when nothing does. `null` is a statement of fact, not a TODO: the clause
   * binds today, and every vendor has signed it.
   */
  actionType: string | null;
  /** Where it is enforced, or what enforcing it would need. */
  note: string;
};

/**
 * § 9.1's major-decisions table, all nine rows, in the contract's own order.
 * ⚠ Do not add a row that is not in § 9.1, and do not drop one that is. The
 * page is generated from this; the contract is not.
 */
export const TWO_ADMIN_PROMISES: readonly TwoAdminPromise[] = [
  {
    key: 'promote-to-admin',
    asPublished: 'promoting a user to any admin role',
    whyPerClause: 'Privilege escalation — irreversible damage potential',
    actionType: 'promote_to_admin',
    note: 'Enforced. In the live CHECK since the approvals table shipped.',
  },
  {
    key: 'internal-account',
    asPublished: 'adding an internal account',
    whyPerClause: 'Bypasses all billing permanently',
    actionType: 'grant_internal_account',
    note: 'Enforced (§ 10a). `users.is_internal = TRUE` passes every paid gate, which is why it is here.',
  },
  {
    key: 'team-pool',
    asPublished: 'adding a team member to the shared pool',
    whyPerClause: 'Grants ongoing pool draw rights',
    actionType: 'grant_team_pool',
    note: 'Enforced (§ 10b). `users.is_team_member = TRUE`.',
  },
  {
    key: 'large-comp-grant',
    asPublished: 'a comp grant above the § 9.1 retail limit',
    whyPerClause: 'Material giveaway',
    actionType: 'approve_comp_grant',
    note: 'Enforced since 2026-09-22 (migration 20271240919693). `issueVendorSkuComp` opens the approval; `executeVendorSkuComp` writes `granted_by` and `approved_by` as two different admins. Threshold: COMP_TWO_ADMIN_THRESHOLD_PHP.',
  },
  {
    key: 'payment-account-change',
    asPublished: 'changing the BDO or GCash receiving account',
    whyPerClause: 'Payment redirection = fraud risk',
    actionType: null,
    note: '⚠ NOT ENFORCED, and arguably the highest-consequence row in the clause: it redirects every future payment rather than moving one amount. The account numbers are platform settings, not repo constants — see `a-zero-is-not-evidence-unless-you-searched-where-the-answer-lives`. Needs the settings write path identified before it can be gated.',
  },
  {
    key: 'mid-quarter-price-change',
    asPublished: 'a mid-quarter price change on any in-app SKU',
    whyPerClause: 'Pricing governance (per § 8)',
    actionType: null,
    note: '⚠ NOT ENFORCED. Prices live in `platform_retail_catalog_v2`, which is admin-managed — the single place a customer-charged price comes from. Gating this means gating that table\'s write path, not adding a constant.',
  },
  {
    key: 'vendor-force-delisting',
    asPublished: 'force-delisting a vendor without the due-process timeline',
    whyPerClause: 'Vendor protection',
    actionType: null,
    note: '⚠ NOT ENFORCED. Distinct from `approve_fraud_wipe_ban`, which is in the live CHECK and covers the fraud path; this row is the NON-fraud revocation that skips the timeline the vendor was promised.',
  },
  {
    key: 'large-refund',
    asPublished: 'refunding a single transaction above the § 9.1 limit',
    whyPerClause: 'Financial control',
    actionType: 'approve_large_refund',
    note: 'Enforced since 2026-09-22 (migration 20271241619056). `refundOrder` opens an approval above REFUND_TWO_ADMIN_THRESHOLD_PHP and refunds directly at or below it, per § 9.1\'s single-admin row.',
  },
  {
    key: 'republish-rejected-vendor',
    asPublished: 're-publishing a previously rejected vendor application',
    whyPerClause: 'Verification integrity',
    actionType: null,
    note: '⚠ NOT ENFORCED. `approve_vendor_partnership` is in the live CHECK but covers the partnership decision, not the re-publication of an application already rejected once.',
  },
];

/** Rows § 9.1 binds that nothing in the code enforces. */
export function unimplementedPromises(): readonly TwoAdminPromise[] {
  return TWO_ADMIN_PROMISES.filter((p) => p.actionType === null);
}

/** Rows that are enforced, with the action type that does it. */
export function enforcedPromises(): readonly TwoAdminPromise[] {
  return TWO_ADMIN_PROMISES.filter((p) => p.actionType !== null);
}
