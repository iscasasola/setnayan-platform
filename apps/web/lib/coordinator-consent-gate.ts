/**
 * RA 10173 consent gate on the coordinator host invite — gated by the
 * admin-approved Data Privacy control board, NOT an env flag.
 *
 * When the `coordinator_consent_money` control is ACTIVE (an admin approves it
 * at /admin/data-privacy — the recorded RA 10173 approval, approved_by/at),
 * sending a coordinator invite requires the couple's data-privacy consent, and
 * the couple's optional "Can lock vendors" / "Can handle payments" scopes gate
 * the money-adjacent paths. INACTIVE (default, fail-closed) = exact current
 * behavior. Server-only (reads the control via the admin client).
 *
 * Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 3a.
 */
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

export async function isCoordinatorConsentGateEnabled(): Promise<boolean> {
  return isDataPrivacyControlActive('coordinator_consent_money');
}
