/**
 * setnayan-ai-guard-plan.ts — the PURE emission planner for Setnayan AI guard
 * notifications (Setnayan_AI_Realtime_Notifications_2026-07-02 spec § 4).
 *
 * Takes the trigger engine's raw interventions + the persisted cooldown state
 * and decides exactly WHAT notifies: which interventions survive restraint,
 * which NotificationType each maps to, the tray title, the rendered body, and
 * the deep-link. No I/O, no clock of its own — fully unit-testable. The
 * server-side sweep (lib/setnayan-ai-notify.ts) feeds it and delivers.
 *
 * Restraint, in code (spec § 4 "the premium feel"):
 *   • GUARD category only — secretary/commend/etc. stay in the weekly digest
 *     (pull-only on the account page). Interruptions must be earned.
 *   • Persistent dedup — the caller passes the dedupe keys notified within the
 *     cooldown window (setnayan_ai_guard_log); applyRestraint drops them.
 *   • Per-event cap — at most GUARD_NOTIFY_MAX_PER_SWEEP per sweep; overflow
 *     waits (it re-fires next sweep if still true, or lands in the digest).
 *   • Channel split — only GRD-01 (payment due) maps to the email-allowlisted
 *     'ai_payment_due'; every other guard maps to in-app-only 'ai_guard_alert'.
 */
import type { NotificationType } from './notifications';
import { applyRestraint, type Intervention } from './setnayan-ai-triggers';
import { renderTemplate, WEDDING_TERMINOLOGY } from './setnayan-ai-templates';

type Terminology = Parameters<typeof renderTemplate>[2];

/** Max guard notifications emitted per event per sweep (spec § 4.3 proposes ≤3/week). */
export const GUARD_NOTIFY_MAX_PER_SWEEP = 3;
/** Days a dedupe key stays cooled down after notifying — never the same alert twice a week. */
export const GUARD_NOTIFY_COOLDOWN_DAYS = 7;
/** Min hours between sweeps of the same event (the '__sweep__' throttle row). */
export const GUARD_SWEEP_MIN_INTERVAL_HOURS = 6;
/** Reserved dedupe_key for the per-event sweep-throttle row in setnayan_ai_guard_log. */
export const GUARD_SWEEP_THROTTLE_KEY = '__sweep__';

export type GuardNotification = {
  dedupeKey: string;
  templateId: string;
  type: NotificationType;
  /** Concise tray/subject line. */
  title: string;
  /** The rendered deterministic template copy. */
  body: string;
  /** App-relative deep link (joined onto NEXT_PUBLIC_APP_URL for email). */
  relatedUrl: string;
};

/** Tray title per template — short + specific; the body carries the details. */
function guardTitle(iv: Intervention): string {
  switch (iv.templateId) {
    case 'GRD-01':
      return `Payment due soon — ${iv.slots.vendor}`;
    case 'GRD-02':
      return `Document deadline — ${iv.slots.document}`;
    case 'GRD-05':
      return 'Budget check — you’re over target';
    case 'GRD-07':
      return `Decision window closing — ${iv.slots.vendor}`;
    default:
      return 'Setnayan AI flagged something';
  }
}

/** Deep link per template — land the couple where they can act. */
function guardUrl(iv: Intervention, eventId: string): string {
  switch (iv.templateId) {
    case 'GRD-01':
    case 'GRD-05':
      return `/dashboard/${eventId}/budget`;
    case 'GRD-02':
      return `/dashboard/${eventId}/paperwork`;
    default:
      return `/dashboard/${eventId}/progress`;
  }
}

/**
 * Plan what notifies for one event this sweep. Pure: interventions (from
 * runTriggers over the event's snapshot) + the cooled-down dedupe keys →
 * the capped, deduped, rendered guard notifications.
 */
export function planGuardNotifications(
  interventions: Intervention[],
  opts: {
    eventId: string;
    cooldown: ReadonlySet<string>;
    terminology?: Terminology;
    maxPerSweep?: number;
  },
): GuardNotification[] {
  const guards = interventions.filter((iv) => iv.category === 'guard');
  const surfaced = applyRestraint(guards, {
    maxProactive: opts.maxPerSweep ?? GUARD_NOTIFY_MAX_PER_SWEEP,
    cooldown: opts.cooldown,
  });
  const terminology = opts.terminology ?? WEDDING_TERMINOLOGY;
  return surfaced.map((iv) => ({
    dedupeKey: iv.dedupeKey,
    templateId: iv.templateId,
    type: (iv.templateId === 'GRD-01' ? 'ai_payment_due' : 'ai_guard_alert') as NotificationType,
    title: guardTitle(iv),
    body: renderTemplate(iv.templateId, iv.slots, terminology, iv.variant ?? 'default'),
    relatedUrl: guardUrl(iv, opts.eventId),
  }));
}

// ---- GRD-01 day-before scheduled email (Resend `scheduledAt`, cron-free) ----

export type PaymentDueReminderPlan = {
  /** Guard-log dedupe key for the scheduled send — stamped once, never re-scheduled. */
  dedupeKey: string;
  /** ISO instant Resend should deliver at: 09:00 Asia/Manila, 1 day before due. */
  scheduledAtIso: string;
  subject: string;
  bodyText: string;
};

/**
 * Plan the spec's GRD-01 scheduled send (§ 3 "time-based events → Resend
 * scheduledAt, cron-free"): when a payment-due intervention fires with more
 * than a day of runway, ALSO schedule a day-before reminder email so the
 * couple is covered even if they never reopen the app before the due date.
 * Delivery is 09:00 Asia/Manila (inside the spec's quiet-hours rule — caught
 * anytime, delivered politely). Returns null when the due date is too close
 * (the immediate emitNotification email already covers it) or unparseable.
 *
 * Honesty rail: the email copy carries an "already settled? ignore this" line
 * because a payment logged AFTER scheduling doesn't cancel the send —
 * re-stamping/cancelling on ledger edits needs hooks at the line-item write
 * sites (a follow-up; those files are owned by another workstream this round).
 */
export function planPaymentDueReminder(
  iv: Intervention,
  now: Date,
): PaymentDueReminderPlan | null {
  if (iv.templateId !== 'GRD-01') return null;
  const dueDate = String(iv.slots.due_date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(dueDate)) return null;
  const dayBefore = new Date(`${dueDate.slice(0, 10)}T09:00:00+08:00`);
  if (Number.isNaN(dayBefore.getTime())) return null;
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  // Needs at least an hour of runway — otherwise the immediate email suffices.
  if (dayBefore.getTime() - now.getTime() < 60 * 60 * 1000) return null;
  const vendor = String(iv.slots.vendor ?? 'a vendor');
  const amount = String(iv.slots.amount ?? '');
  return {
    dedupeKey: `${iv.dedupeKey}#d1`,
    scheduledAtIso: dayBefore.toISOString(),
    subject: `Reminder: your ${vendor} payment is due tomorrow`,
    bodyText: [
      `Your ${vendor} payment${amount ? ` (₱${amount})` : ''} is due tomorrow, ${dueDate.slice(0, 10)}.`,
      '',
      'If you’ve already settled this, you can ignore this note — your ledger may simply not have caught up yet.',
    ].join('\n'),
  };
}
