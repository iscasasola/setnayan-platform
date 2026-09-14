/**
 * delegate-access-window.ts — a delegate's access ENDS, the couple's never does.
 *
 * Owner, 2026-09-14: "coordinators will only have access until event day. but
 * no access after." Asked what happens to wrap-up work, he set the window:
 * **"grace period until 7 days after event"**.
 *
 * ── WHAT THIS FIXES ───────────────────────────────────────────────────────
 * Nothing in this codebase expired a delegate. `resolveAreaLevel` has ~38 call
 * sites and not one consults a date; `event_moderators.invitation_expires_at`
 * expires the INVITE LINK, never the access it granted. So a planner hired for
 * one wedding kept the guest list, the seat plan, the schedule, the suppliers
 * and the invitations — with every guest's name, email and mobile — forever.
 *
 * ── WHY IT IS A PURE FUNCTION AND NOT A CHECK IN THE LOADER ───────────────
 * 🔑 THERE IS NO SINGLE CHOKEPOINT. Five separate places read
 * `event_moderators.permissions_json` — `event-viewer.server.ts`,
 * `coordinator-broadcasts-server.ts`, `budget-visibility.ts`,
 * `run-of-show-advance.ts` and the schedule page. A window enforced in one of
 * them is a window that four surfaces ignore, which is worse than none: it
 * reads as closed while standing open. One pure rule, applied by every reader,
 * is the only shape that can be checked — and
 * `delegate-access-window.test.ts` asserts every reader imports it.
 */

/** The grace period, in days, after the event ends. Owner-set 2026-09-14. */
export const DELEGATE_GRACE_DAYS = 7;

export type AccessWindowInput = {
  /** True for the couple's own rows — their access NEVER expires. */
  isCouple: boolean;
  /** `events.event_date` (ISO `YYYY-MM-DD`), or null when no date is set. */
  eventDate: string | null | undefined;
  /** `events.event_end_date` for a multi-day event; null for a single day. */
  eventEndDate?: string | null | undefined;
  /** `events.event_date_precision` — 'day' | 'month' | 'year' in practice. */
  precision?: string | null | undefined;
  /** Now, injected so the rule is testable and has no hidden clock. */
  now: Date;
};

/**
 * Has a DELEGATE's access window closed?
 *
 * Every branch that returns `false` (still open) is a deliberate refusal to
 * guess, because the failure mode is asymmetric: closing early locks a working
 * coordinator out of a wedding they are running THAT WEEK, which is loud and
 * immediate. Leaving it open a while longer is the status quo we are improving
 * on, and the couple can still remove them by hand.
 */
export function delegateAccessHasExpired(input: AccessWindowInput): boolean {
  // The couple are not delegates. Their own event does not expire for them.
  if (input.isCouple) return false;

  // ⚠ NO DATE, NO EXPIRY. One live event has `event_date IS NULL` (measured
  // 2026-09-14). A null date is "not decided yet", not "long ago" — treating it
  // as expired would lock a planner out of the very event they are helping to
  // schedule.
  const anchor = input.eventEndDate?.trim() || input.eventDate?.trim();
  if (!anchor) return false;

  // ⚠ AN IMPRECISE DATE DOES NOT EXPIRE ANYONE. `event_date_precision` is
  // 'year' on a live event today: its `event_date` is a placeholder inside a
  // year, not a day anybody is getting married on. Counting seven days from a
  // placeholder would revoke a planner months before the wedding. Only a
  // day-precise date closes a window.
  if (input.precision && input.precision !== 'day') return false;

  const end = Date.parse(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(end)) return false; // unparseable = unknown = open

  // The window closes at the END of the seventh day after the event, so a
  // coordinator wrapping up ON day seven still has it.
  const closesAt = end + (DELEGATE_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000;
  return input.now.getTime() >= closesAt;
}

/**
 * The permissions a reader should actually use: the row's own, or NOTHING once
 * the window has closed.
 *
 * Returning `null` rather than an empty map is deliberate — `resolveAreaLevel`
 * already treats null as "no grant at all", so an expired delegate takes the
 * exact path a stranger takes, with no second code path to keep in step.
 */
export function permissionsWithinWindow<T>(
  permissions: T | null | undefined,
  input: AccessWindowInput,
): T | null {
  if (!permissions) return null;
  return delegateAccessHasExpired(input) ? null : permissions;
}
