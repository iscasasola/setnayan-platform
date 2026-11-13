/**
 * account-suspension.ts — PUTTING A PERSON'S ACCOUNT ON HOLD. The pure half: no database, no `server-only`.
 *
 * ⚖ Owner 2026-11-13, verbatim "Yes, add both" (specs DECISION_LOG "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN
 * CONTENTS"). Ported from the approved prototype `prototypes/admin_pub/people.html` — `cfm-suspend-person` (the
 * reasons), `date-suspend` (7 days · 30 days · until lifted), `cfm-unsuspend-person` (Unsuspend with Undo).
 *
 * The gentler step before Ban and Delete: a suspended person cannot sign in (GoTrue `banned_until`, set through the
 * admin API), every shop they own is suspended the way the fraud desk suspends one, and nothing is deleted. The
 * database half is `admin_suspend_account` / `admin_lift_account_suspension` (migration 20271344061337).
 */

/** The reasons on the Suspend sheet — the prototype's list, verbatim. The stored value is the label. */
export const SUSPEND_REASONS = [
  'Fraud or fake bookings',
  'Abuse or harassment',
  'Spam',
  'Payment dispute under review',
  'Asked by the person',
  'Other',
] as const;
export type SuspendReason = (typeof SUSPEND_REASONS)[number];

export function isSuspendReason(v: unknown): v is SuspendReason {
  return typeof v === 'string' && (SUSPEND_REASONS as readonly string[]).includes(v);
}

/** How long — the prototype's three quick picks (`date-suspend`). */
export const SUSPEND_DURATIONS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: 'lifted', label: 'Until lifted', days: null },
] as const;
export type SuspendDurationKey = (typeof SUSPEND_DURATIONS)[number]['key'];

export function isSuspendDuration(v: unknown): v is SuspendDurationKey {
  return typeof v === 'string' && SUSPEND_DURATIONS.some((d) => d.key === v);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the hold lifts itself. `null` = until an admin lifts it. */
export function suspendUntilFor(choice: SuspendDurationKey, now: Date): Date | null {
  const d = SUSPEND_DURATIONS.find((x) => x.key === choice)!;
  return d.days === null ? null : new Date(now.getTime() + d.days * DAY_MS);
}

/**
 * "Until lifted" as a sign-in ban — about a hundred years. GoTrue takes a Go duration and has no "forever"; the
 * lift sets `none`, so the length only has to outlast any real hold.
 */
export const UNTIL_LIFTED_BAN_HOURS = 876_000;

/**
 * The GoTrue `ban_duration` for a hold (`updateUserById`). Rounded UP to the next whole hour so the sign-in ban never
 * ends before the hold does; the lift job clears the database half on the same date.
 */
export function banDurationFor(until: Date | null, now: Date): string {
  if (until === null) return `${UNTIL_LIFTED_BAN_HOURS}h`;
  const hours = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / (60 * 60 * 1000)));
  return `${hours}h`;
}

/** The lift: GoTrue's own word for "not banned". */
export const BAN_LIFTED = 'none';

/** Is this account on hold right now? An expired `suspended_until` is not a hold (the lift job will clear it). */
export function isSuspendedNow(
  row: { suspended_at?: string | null; suspended_until?: string | null } | null | undefined,
  now: Date,
): boolean {
  if (!row?.suspended_at) return false;
  if (!row.suspended_until) return true;
  return new Date(row.suspended_until).getTime() > now.getTime();
}

/** "13 Dec 2026" in Manila — how a date reads in every notice and on the admin page. */
export function holdDateWords(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

/** Why, in words the PERSON reads — never the admin's category label, never the admin's note. */
const REASON_WORDS: Record<SuspendReason, string> = {
  'Fraud or fake bookings': 'while we look at bookings made from it',
  'Abuse or harassment': 'while we look at reports about how it was used',
  Spam: 'while we look at messages sent from it',
  'Payment dispute under review': 'while we look at a payment dispute',
  'Asked by the person': 'as you asked',
  Other: 'while we look into something on it',
};

/** The one in-app notice when a hold starts. Plain words: what happened, until when, that nothing is gone. */
export function suspendedNotice(reason: SuspendReason, until: Date | null): { title: string; body: string } {
  const when = until ? `until ${holdDateWords(until)}` : 'until our team lifts it';
  return {
    title: 'Your account is on hold',
    body: `Your account is on hold ${when}, ${REASON_WORDS[reason]}. You can't sign in or make changes while it's on hold. Nothing has been deleted — your events, photos and records are kept as they are. To ask about it, write to our help desk.`,
  };
}

/** The one in-app notice when a hold is lifted (by an admin or on its date). */
export function liftedNotice(shopsLifted: number): { title: string; body: string } {
  const shop =
    shopsLifted > 0
      ? ' Your shop is back too, but hidden from search until our team lists it again.'
      : '';
  return {
    title: 'Your account is active again',
    body: `The hold on your account has been lifted. You can sign in and carry on where you left off.${shop}`,
  };
}

/** What the sign-in card says to a suspended person (GoTrue answers "User is banned"). */
export const SUSPENDED_SIGN_IN =
  'This account is on hold, so it can’t sign in right now. Nothing has been deleted. Write to our help desk to ask about it.';

/** GoTrue's refusal for a banned user. */
export const BANNED_REFUSAL = /\bbanned\b/i;
