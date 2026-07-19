/**
 * Feature flag — RA 10173 consent gate on the coordinator host invite.
 *
 * When ON, sending a coordinator (wedding_planner_external) host invite
 * requires the couple to pass a data-privacy consent modal (unticked
 * checkbox by default), and the server records the consent in
 * public.coordinator_access_consents before creating the invite.
 *
 * Default OFF — pending DPO review of two open sub-decisions (biometric
 * scope-out · decline-path lawful basis). Flag OFF = exact current behavior
 * (no modal, no server requirement, no record written). Read on both the
 * server action (inviteHost) and the client form gate, so it must be a
 * NEXT_PUBLIC_ variable.
 *
 * Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 3a.
 * Mirrors lib/payment-gated-lock.ts.
 */
export function isCoordinatorConsentGateEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
