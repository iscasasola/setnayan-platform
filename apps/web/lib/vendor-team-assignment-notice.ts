/**
 * vendor-team-assignment-notice.ts — the PURE half of "assigning work notifies
 * the team member".
 *
 * Spec: Vendor_Monetization_Model_LOCKED_2026-07-25.md § 7 — "each agent has
 * their own calendar; the owner sees a unified team calendar; assigning a
 * booking **notifies the agent** ('You've been booked for [event]')."
 *
 * This module decides WHETHER to notify and WHAT the notification says. It
 * performs no I/O, reads no env and no clock — the delivery side lives in
 * `lib/vendor-team-assignment-notify.ts`, which is server-only and flag-gated.
 *
 * Two assignment shapes are supported:
 *   • `booking`  — the § 7 case: a specific event/booking handed to a member.
 *   • `services` — the shape that exists in the product TODAY
 *                  (`vendor_service_agents`, set from the Team page). Wired now;
 *                  the booking shape plugs in when a booking→member assignment
 *                  column exists (owned by another track — see the report).
 */

/** DB enum label added by the vendor-team-roles migration. */
export const VENDOR_ASSIGNMENT_NOTIFICATION_TYPE = 'vendor_assignment_received';

export type VendorAssignmentSubject =
  | { kind: 'booking'; eventName: string; eventDateIso?: string | null }
  /**
   * `serviceCount` is the number of services NEWLY ADDED by this save — the
   * DELTA, not the new total. See {@link assignmentServiceDelta}.
   */
  | { kind: 'services'; serviceCount: number };

/**
 * What changed in a services save.
 *
 * The notice must describe the HAND-OFF, not the resulting state. Sending "the
 * new total" meant a revocation notified the member ("You've been assigned 1
 * service" after stripping 4 of their 5) and a no-op save notified them too.
 * (Adversarial review 2026-07-26, defect 3.)
 *
 * Pure set arithmetic; duplicates and ordering in either list are irrelevant.
 */
export function assignmentServiceDelta(
  prior: ReadonlyArray<string>,
  next: ReadonlyArray<string>,
): { added: string[]; removed: string[] } {
  const before = new Set(prior);
  const after = new Set(next);
  return {
    added: [...after].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !after.has(id)),
  };
}

export type VendorAssignmentInput = {
  /** The user being assigned to (notification recipient). */
  assigneeUserId: string;
  /** The admin performing the assignment. */
  actorUserId: string;
  subject: VendorAssignmentSubject;
};

export type VendorAssignmentNotice = {
  userId: string;
  /** Widened to `string` on purpose — see the note in the notify module. */
  type: string;
  title: string;
  body: string;
  relatedUrl: string;
};

/**
 * Notify only when there is a REAL hand-off:
 *   • never notify yourself (an admin assigning their own row),
 *   • never notify when NOTHING WAS ADDED — `serviceCount` is the delta, so a
 *     pure revocation (added 0, removed 4) and a no-op re-save (added 0) both
 *     land here and stay silent,
 *   • never notify a missing recipient.
 */
export function shouldNotifyAssignment(input: VendorAssignmentInput): boolean {
  if (!input.assigneeUserId) return false;
  if (input.assigneeUserId === input.actorUserId) return false;
  if (input.subject.kind === 'services' && input.subject.serviceCount <= 0) return false;
  return true;
}

/** Notification title + body. `null` when {@link shouldNotifyAssignment} says no. */
export function buildAssignmentNotice(
  input: VendorAssignmentInput,
): VendorAssignmentNotice | null {
  if (!shouldNotifyAssignment(input)) return null;

  if (input.subject.kind === 'booking') {
    const name = input.subject.eventName.trim() || 'an event';
    const when = input.subject.eventDateIso?.trim();
    return {
      userId: input.assigneeUserId,
      type: VENDOR_ASSIGNMENT_NOTIFICATION_TYPE,
      // § 7's own words. Title is capped at 160 chars by the notifications
      // CHECK; slice defensively so a long event name can never fail the insert.
      title: `You've been booked for ${name}`.slice(0, 160),
      body: when
        ? `Your team assigned this booking to you — ${name} on ${when}. It's on your calendar.`
        : `Your team assigned this booking to you — ${name}. It's on your calendar.`,
      relatedUrl: '/vendor-dashboard/customers',
    };
  }

  // `n` is the number of services ADDED by this save (the delta).
  const n = input.subject.serviceCount;
  return {
    userId: input.assigneeUserId,
    type: VENDOR_ASSIGNMENT_NOTIFICATION_TYPE,
    title: `You've been assigned ${n} new service${n === 1 ? '' : 's'}`.slice(0, 160),
    body: `Your team assigned ${n} new service${n === 1 ? '' : 's'} to you. Their bookings and clients now show on your dashboard.`,
    relatedUrl: '/vendor-dashboard/customers',
  };
}
