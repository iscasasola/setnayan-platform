/**
 * Person-spine · Phase 3 · STEWARDED ("BRANCH") ACCOUNTS — feature flag + types.
 *
 * ⚠⚠ PHASE 3 IS COUNSEL-FIRST and touches MINORS + POST-MORTEM / SUCCESSION law.
 * `stewardedAccountsEnabled()` defaults OFF and stays off until PH counsel + the
 * DPO (Claire E. Buanhog) clear the flow AND the minors + post-mortem DPIAs are
 * done. This module only RESERVES the flag + shapes; there is no flow, no action,
 * and no data processing here — the inert schema is
 * `supabase/migrations/…_phase3_stewardship_scaffolding.sql`.
 *
 * The one primitive (locked 2026-07-05): a "branch" is a person node held by a
 * STEWARD (guardian OR estate) whose OWNERSHIP is transferable — a minor's branch
 * is guardian-held and transfers at the age of majority (18); a deceased person's
 * memories pass down the DIRECT LINE to an heir, or become a memorial. Ownership
 * itself lives on `people.claimed_by_user_id`. Design:
 * 03_Strategy/Stewarded_Branch_Accounts_Phase3_Design_2026-07-05.md.
 */

/** Guardian (minor, pre-majority) vs estate (post-life). */
export type StewardshipKind = 'guardian' | 'estate';

/** Lifecycle of a stewardship record. */
export type StewardshipStatus = 'active' | 'relinquished' | 'revoked';

/** Kinds of ownership transfer captured in the append-only audit. */
export type StewardshipTransferKind = 'majority' | 'inheritance' | 'revocation';

/**
 * OFF until PH counsel + DPO clear Phase 3 and the owner sets
 * `NEXT_PUBLIC_STEWARDED_ACCOUNTS=1`. Kept as a function (not a module const) so
 * it is re-read per request. Mirrors `peopleConnectionsEnabled()` /
 * `personLifeStoriesEnabled()`.
 *
 * NOTE: flipping this flag alone does NOT make Phase 3 safe to run — the actual
 * guardian/transfer flow is deliberately unbuilt until counsel sign-off + DPIAs.
 */
export function stewardedAccountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STEWARDED_ACCOUNTS === '1';
}
