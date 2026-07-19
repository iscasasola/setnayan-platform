/**
 * Feature flag — coordinator "propose a lock" (money-adjacent guard).
 *
 * When ON, a coordinator (event_moderators wedding_planner_external) who tries
 * to lock/finalize a vendor does NOT lock directly — `finalizeVendor` records a
 * pending `vendor_lock_proposals` row and returns `{ status: 'proposed' }`. The
 * couple then confirms (which fires the normal lock as the couple).
 *
 * Default OFF — flag OFF = current behavior (a coordinator with
 * COORDINATOR_AREAS.vendors='edit' locks directly via event_vendors_moderator_write,
 * audit-logged to the couple). This is a behavior change (removes coordinators'
 * direct lock), so it ships flag-off until the owner flips it.
 *
 * Read on the server action (finalizeVendor) and the client (button label /
 * result handling), so it must be NEXT_PUBLIC_. Mirrors lib/payment-gated-lock.ts.
 *
 * Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 0 / § 4.
 */
export function isCoordinatorProposeLockEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
