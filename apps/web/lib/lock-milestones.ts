/**
 * Lock milestones — "Congratulations! You picked a X" + "You can now finalize Y".
 *
 * When a couple locks a vendor (finalizeVendor), two things should surface:
 *   1. A celebratory acknowledgement of what they just committed to
 *      ("Congratulations! You have picked a Reception venue!").
 *   2. When that lock COMPLETES the prerequisites for a downstream feature, an
 *      optional call-to-action to finalize it ("You can now finalize your
 *      Save the Date"). Example: Save the Date needs the wedding date + both
 *      the ceremony and reception venues.
 *
 * This module is the single source of truth for those prerequisite rules so the
 * server action and any future surface compute the same milestones.
 */

import type { PlanGroupId } from './wedding-plan-groups';

export type FinalizeMilestoneDef = {
  key: string;
  /** Feature name shown in the CTA — "Save the Date". */
  featureLabel: string;
  /** One-line reason the feature just unlocked. */
  helper: string;
  /** Whether a committed wedding date is a prerequisite. */
  requiresDate: boolean;
  /** Plan-group ids that must each have a confirmed (locked) vendor. */
  requiredGroupIds: PlanGroupId[];
  /** Deep link to the feature's finalize surface. */
  href: (eventId: string) => string;
};

export const FINALIZE_MILESTONES: FinalizeMilestoneDef[] = [
  {
    key: 'save_the_date',
    featureLabel: 'Save the Date',
    helper: 'Your date and both venues are set.',
    requiresDate: true,
    requiredGroupIds: ['ceremony_venue', 'reception_venue'],
    href: (eventId) => `/dashboard/${eventId}/studio/save-the-date`,
  },
  {
    key: 'seating_chart',
    featureLabel: 'Seating Chart',
    helper: 'Your reception venue is locked in.',
    requiresDate: false,
    requiredGroupIds: ['reception_venue'],
    href: (eventId) => `/dashboard/${eventId}/seating`,
  },
];

/**
 * Returns the milestone whose prerequisites are NOW fully met AND which this
 * lock contributed to — so the "you can now finalize X" CTA appears on the lock
 * that completed the set, not on every later lock.
 *
 * @param hasDate            event has a committed wedding date (post-lock).
 * @param confirmedGroupIds  plan-group ids with ≥1 confirmed vendor (post-lock).
 * @param justLockedGroupId  plan group of the vendor just locked (null if the
 *                           contribution was the date itself being locked).
 * @param dateJustLocked     true when THIS action also locked the wedding date
 *                           (force-to-one flow) — lets a date-completing lock
 *                           trigger a date-gated milestone.
 */
export function computeFinalizeReady(opts: {
  hasDate: boolean;
  confirmedGroupIds: Set<string>;
  justLockedGroupId: string | null;
  dateJustLocked: boolean;
}): FinalizeMilestoneDef | null {
  for (const m of FINALIZE_MILESTONES) {
    const contributedByGroup =
      opts.justLockedGroupId !== null &&
      (m.requiredGroupIds as readonly string[]).includes(opts.justLockedGroupId);
    const contributedByDate = opts.dateJustLocked && m.requiresDate;
    if (!contributedByGroup && !contributedByDate) continue;

    if (m.requiresDate && !opts.hasDate) continue;
    const allGroupsMet = m.requiredGroupIds.every((g) => opts.confirmedGroupIds.has(g));
    if (allGroupsMet) return m;
  }
  return null;
}
