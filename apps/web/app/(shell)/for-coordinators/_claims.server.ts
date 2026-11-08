/**
 * _claims.server.ts — reads the four live switches /for-coordinators' claims depend on.
 *
 * Each one is read through the SAME function the feature itself is gated by, so the page and the
 * product can never disagree about whether a thing is on. Every reader fails closed — an unread
 * switch is OFF — so a database hiccup makes the page say less, never promise more.
 * See `_claims.ts` for which line needs which switch.
 */

import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { isCoordinatorP3Enabled } from '@/lib/coordinator-broadcasts-server';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';
import { isCoordinatorVendorNotesEnabled } from '@/lib/vendor-working-notes';
import { FREE_SPECIALIZATION_SETS, specializationFreeWindowActive } from '@/lib/vendor-specialization-gate';
import { vendorDayOfFreeUntilIso } from '@/lib/vendor-dayof-free-until';

import type { ClaimSwitches } from './_claims';

export async function readClaimSwitches(): Promise<ClaimSwitches> {
  const [runOfShow, announcements, prepRelease] = await Promise.all([
    isDataPrivacyControlActive('coordinator_run_of_show').catch(() => false),
    isCoordinatorP3Enabled().catch(() => false),
    isCoordinatorPrepReleaseEnabled().catch(() => false),
  ]);
  return {
    runOfShow,
    announcements,
    prepRelease,
    privateNotes: isCoordinatorVendorNotesEnabled(),
    // The SAME two questions the floor-command kit's paywall asks (lib/vendor-specialization-gate.ts):
    // is the set held free for good (`FREE_SPECIALIZATION_SETS`, owner 2026-11-05 "keep it free"), or is
    // the dated free window still open. Either one makes the desk free for a booked coordinator.
    dayOfFree:
      FREE_SPECIALIZATION_SETS.has('floor_command') ||
      specializationFreeWindowActive(vendorDayOfFreeUntilIso(), Date.now()),
  };
}
