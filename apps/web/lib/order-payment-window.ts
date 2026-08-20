/**
 * order-payment-window.ts — how long an unpaid order waits, in ONE place.
 *
 * OWNER RULING 2026-08-20: **fifteen days.** Then it cancels itself. The buyer
 * is warned before it does, and the order is CANCELLED rather than deleted so
 * somebody who paid late can still be shown what happened.
 *
 * WHY 15 AND NOT 7 — recorded because the number will be questioned again.
 * Philippine payroll lands on the 15th and the 30th, so a fifteen-day window
 * always contains exactly one payday whatever day the order is placed; seven
 * can miss both. And the costly failure is not an order lingering — an unpaid
 * order unlocks nothing and merely sits — it is **money arriving against an
 * order that has already cancelled itself**, which a shorter window makes more
 * likely. The window is generous on purpose.
 *
 * 🔑 EVERYTHING DERIVES FROM `PAYMENT_WINDOW_DAYS`, INCLUDING THE SENTENCE THE
 * BUYER READS. This repo has been bitten repeatedly by a number living in two
 * places — a retention period that said one thing in code and another on the
 * public privacy page, and a 12% VAT hardcoded into four screens whose maths
 * had already been fixed. A copy string typed by hand next to a constant is the
 * same defect waiting. So the deadline sentence is BUILT here, never written
 * out at a call site.
 *
 * PURE — no client, no I/O, no `Date.now()` baked in (callers pass `now`), so
 * this is testable in any timezone. The sweep that acts on it lives in
 * `order-payment-window.server.ts`.
 */

/** Owner-set, 2026-08-20. Change this ONE number to change the window. */
export const PAYMENT_WINDOW_DAYS = 15;

/**
 * When the buyer is nudged — halfway, so there is still a full pay cycle left
 * to act on it. A reminder sent the day before a deadline is a notification,
 * not a chance.
 */
export const PAYMENT_REMINDER_AFTER_DAYS = Math.floor(PAYMENT_WINDOW_DAYS / 2);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statuses that mean "this order is waiting for money".
 *
 * ⚠ DELIBERATELY NOT `paid` / `fulfilled` / `cancelled` / `refunded` / `lapsed`.
 * The sweep must never touch an order that settled, was already cancelled, or
 * is a subscription running out its term — that last one is `expires_at`'s job
 * and a different clock entirely.
 */
export const UNPAID_ORDER_STATUSES = ['submitted', 'awaiting_payment'] as const;

/**
 * ⚠ VENDOR ORDERS ARE OUT OF SCOPE, ON PURPOSE AND REVERSIBLY.
 *
 * The ruling was about a CUSTOMER who never pays. A vendor's unpaid booking fee
 * sits in a different relationship — cancelling one may unpick a booking a
 * couple is relying on — and I could not verify those side effects, so this
 * sweep leaves them alone rather than guessing. Widening it later is deleting
 * this predicate; narrowing it after it has cancelled somebody's booking is not
 * a thing you can do.
 */
export function isCustomerOrder(serviceKey: string | null | undefined): boolean {
  return !(typeof serviceKey === 'string' && serviceKey.startsWith('vendor_'));
}

/** The deadline for an order placed at `createdAt`. */
export function paymentDueAt(createdAt: Date | string): Date {
  const t = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Date(t.getTime() + PAYMENT_WINDOW_DAYS * DAY_MS);
}

/** Whole days left to pay — negative once the deadline has passed. */
export function daysLeftToPay(dueAt: Date | string, now: Date | string): number {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const n = typeof now === 'string' ? new Date(now) : now;
  return Math.ceil((due.getTime() - n.getTime()) / DAY_MS);
}

/** Has this order's window closed? */
export function paymentWindowHasClosed(dueAt: Date | string, now: Date | string): boolean {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const n = typeof now === 'string' ? new Date(now) : now;
  return due.getTime() <= n.getTime();
}

/**
 * Is the halfway nudge due for an order falling due at `dueAt`?
 *
 * Expressed as TIME REMAINING rather than time elapsed, because the deadline is
 * the fact we store — deriving "when was this placed" by subtracting the window
 * would break the moment the window is ever changed, and every existing order
 * carries a deadline it was already promised.
 *
 * For a 15-day window with a day-7 nudge, this is true once 8 days or less
 * remain. It stays true afterwards — the caller stops it repeating with the
 * one-time stamp, not with a narrow time band, so a sweep that does not run for
 * a week still sends the nudge instead of silently skipping past its window.
 */
export function reminderIsDue(dueAt: Date | string, now: Date | string): boolean {
  if (paymentWindowHasClosed(dueAt, now)) return false;
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const n = typeof now === 'string' ? new Date(now) : now;
  const remainingMs = due.getTime() - n.getTime();
  return remainingMs <= (PAYMENT_WINDOW_DAYS - PAYMENT_REMINDER_AFTER_DAYS) * DAY_MS;
}

/**
 * The one sentence the buyer reads, built from the constant above.
 *
 * ⚠ `dueAt` is rendered in **Asia/Manila**, not the reader's zone. A deadline is
 * a fact about Setnayan's day, not about where the customer happens to be
 * standing — a relative abroad must not be told a date one day out from the one
 * the business will act on. (Same class as the DATE-column bug that put a
 * 12 December wedding on the 11th for anyone west of Greenwich.)
 */
export function paymentDeadlineSentence(dueAt: Date | string): string {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const when = due.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `Please send payment within ${PAYMENT_WINDOW_DAYS} days — we'll hold this order until ${when}.`;
}

/**
 * Shorter form for a tight space (the order header).
 *
 * 🪤 THIS ASKS `paymentWindowHasClosed` RATHER THAN RE-COMPARING THE DATES, AND
 * THAT IS THE POINT. The first draft made its own `left < 0` comparison, and at
 * the exact deadline instant the two disagreed: the window was closed while this
 * still read "Last day to pay". Two functions answering one question in two
 * ways is the defect this codebase keeps paying for — the wizard that previewed
 * a safe address while the database minted a colliding one was the same shape.
 * One of them is now the authority and the other asks it.
 */
export function paymentDeadlineShort(dueAt: Date | string, now: Date | string): string {
  if (paymentWindowHasClosed(dueAt, now)) return 'Payment window closed';
  const left = daysLeftToPay(dueAt, now);
  // `left` is a CEILING, so any part of the final 24 hours reads 1 — that IS
  // the last day, and there is no reachable 0 short of the closing instant,
  // which the guard above has already taken.
  if (left <= 1) return 'Last day to pay';
  return `${left} days left to pay`;
}
