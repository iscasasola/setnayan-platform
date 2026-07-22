/**
 * Coordinator P1 "prep-then-release" schedule visibility — gated by the
 * admin-approved Data Privacy control board, NOT an env flag.
 *
 * When the `coordinator_prep_release` control is ACTIVE (approved at
 * /admin/data-privacy), a coordinator can stage schedule blocks privately and
 * release them to the couple. INACTIVE (default, fail-closed) = byte-identical
 * to today. Server-only (reads the control via the admin client).
 *
 * ⚠ Do NOT import this into a client-imported module — `lib/schedule.ts` is
 * pulled into a client component (schedule-widget), so it gates by a boolean
 * passed in from its server callers instead of importing this.
 *
 * Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 4.
 */
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

export async function isCoordinatorPrepReleaseEnabled(): Promise<boolean> {
  return isDataPrivacyControlActive('coordinator_prep_release');
}
