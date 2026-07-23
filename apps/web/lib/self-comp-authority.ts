/**
 * Vendor self-comp authorization decision (§ 3.1a Self-purchase confirm).
 *
 * Why this module exists
 * ----------------------
 * The self-comp branch of `createOrder` (app/dashboard/[eventId]/orders/
 * actions.ts) mints an order at status='paid' and runs SKU activation on a
 * caller-supplied `event_id`. The original code only verified the caller was
 * owner/admin of the caller-supplied `vendor_profile_id` — but a
 * self-registered vendor is auto-granted an owner row on their own profile, so
 * that check is trivially satisfiable and, crucially, said NOTHING about the
 * target event. A vendor could therefore provision a paid SKU (flip
 * events.setnayan_ai_active, materialise Papic seats, …) onto a STRANGER'S
 * event they have no relationship with.
 *
 * The fix: self-comp is "comp for MYSELF" — the buyer provisioning their OWN
 * event. So the caller must ALSO be a couple member of the target event. That
 * scopes vendor self-comp to the vendor's own weddings (still bounded by the
 * per-quarter `enforce_vendor_self_comp_quota` trigger on comp_grants) and
 * closes the arbitrary-event hole.
 *
 * Pure + unit-testable: the DB reads happen in the action; this function only
 * decides given their results, so it can be mutation-tested without a DB.
 */

/** Role a user holds on a `vendor_profiles` row (vendor_team_members.role). */
export type VendorTeamRole = 'owner' | 'admin' | 'agent' | 'viewer';

export type SelfCompAuthorityInput = {
  /**
   * The caller's role on the target vendor_profile, or null when they are not
   * on that vendor's team at all. Only owner/admin may self-comp.
   */
  vendorRole: VendorTeamRole | null;
  /**
   * True iff the caller is a `member_type='couple'` member of the target
   * event_id. This is the load-bearing authority-over-the-event check the
   * original code was missing.
   */
  isCoupleMemberOfEvent: boolean;
};

export type SelfCompAuthorityDecision = {
  allowed: boolean;
  /** Machine-readable reason so the action can throw a targeted message. */
  reason: 'ok' | 'not_vendor_owner_admin' | 'not_event_couple';
};

/**
 * Decide whether a vendor self-comp may proceed against a specific event.
 *
 * BOTH must hold:
 *   1. The caller owns/admins the target vendor profile (comp authority), AND
 *   2. The caller is a couple member of the target event (event authority).
 *
 * Fails closed — any missing signal denies.
 */
export function decideSelfCompAuthority(
  input: SelfCompAuthorityInput,
): SelfCompAuthorityDecision {
  if (input.vendorRole !== 'owner' && input.vendorRole !== 'admin') {
    return { allowed: false, reason: 'not_vendor_owner_admin' };
  }
  if (!input.isCoupleMemberOfEvent) {
    return { allowed: false, reason: 'not_event_couple' };
  }
  return { allowed: true, reason: 'ok' };
}
