/**
 * planner-seats.ts — which hired-planner seats belong on ONE planner's
 * supplier workspace.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS…", item 6): "Promote your booked coordinator" leaves the Hosts page
 * for Your Team — the planner's own supplier workspace. The seat it creates
 * (`event_moderators.role_subtype = 'wedding_planner_external'`) names no
 * vendor, so the workspace has to decide which seats are this supplier's.
 *
 * 🔑 THE SAME MATCH BOTH INVITE DOORS ALREADY USE: the seat's
 * `invitation_email` against the booking's `contact_email`, trimmed and
 * case-folded — `autoInviteCoordinator` (lib/coordinator-grant.ts) dedupes on
 * it, and the Hosts page hid an already-invited planner on it.
 *
 * ⚠ AND A SEAT NO BOOKING CLAIMS IS SHOWN ON EVERY PLANNER'S WORKSPACE, never on
 * none. Measured on prod 2026-09-30: the one live planner seat has NO
 * invitation email at all (it predates the email being stored), so an
 * email-only match would have left the one hired planner on the platform with
 * no screen where the couple can see or remove them. Homeless is the failure;
 * shown twice is recoverable.
 *
 * PURE, so `planner-seats.test.ts` runs it.
 */

/** The seat kind a hired planner holds — never a guest-list Access level. */
export const PLANNER_SEAT_ROLE = 'wedding_planner_external';

function fold(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase();
  return t ? t : null;
}

export function plannerSeatsForVendor<T extends { role_subtype: string; invitation_email: string | null }>(
  seats: readonly T[],
  vendorEmail: string | null,
  /** `contact_email` of EVERY planner booking on the event, this one included. */
  plannerVendorEmails: readonly (string | null)[],
): T[] {
  const mine = fold(vendorEmail);
  const claimed = new Set(plannerVendorEmails.map(fold).filter((e): e is string => e !== null));
  return seats.filter((s) => {
    if (s.role_subtype !== PLANNER_SEAT_ROLE) return false;
    const email = fold(s.invitation_email);
    if (email === null || !claimed.has(email)) return true;
    return email === mine;
  });
}
