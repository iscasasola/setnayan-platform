/**
 * anon-draft-reminder.ts — "your draft is deleted in 3 days" for an unfinished
 * no-account draft. The rule, the address and the words. Pure — no I/O — so the
 * sweep (`lib/anon-draft-sweep.ts`) and its tests share one answer.
 *
 * ⚖ OWNER 2026-10-02 (tracker d11, amends the June "flag, never erase" lock):
 * *"keep the automatic delete of unfinished no-account drafts after 30 days,
 * add a reminder email a few days before"*. Three days: the corpus names no
 * other number, and it is long enough to act on over a weekend while still
 * reading as urgent (the same reasoning as the supplier credit warning's
 * seven, scaled to a 30-day draft).
 *
 * 📭 A DRAFT THAT HOLDS NO EMAIL IS SKIPPED, AND SAYS SO. A no-account draft is
 * a Supabase anonymous user: its only address is the non-routable placeholder
 * (`anon+<uuid>@anon.setnayan.local`, `isPlaceholderEmail`). Securing the plan
 * writes a real email AND flips the account to permanent in one step
 * (signup/actions.ts), after which the sweep never touches it. So, measured in
 * production 2026-10-02, every live draft (7) holds no email — this sends to
 * nobody today, and the sweep logs each skip rather than pretending it warned.
 * It starts sending the day a draft carries a real address (an auth email or a
 * profile email that is not the placeholder).
 */
import { isPlaceholderEmail } from './anon-onboarding';

/** How long an unfinished no-account draft lives (the sweep's TTL). */
export const ANON_DRAFT_TTL_DAYS = 30;
/** How long before the delete the reminder goes out. */
export const ANON_DRAFT_REMINDER_DAYS_BEFORE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this draft inside its reminder window — old enough to be warned, not yet
 * old enough to be deleted? An unparseable date is never "due" (a false alarm
 * about somebody's plan is its own harm).
 */
export function draftReminderDue(createdAtIso: string | null | undefined, nowMs: number): boolean {
  if (!createdAtIso) return false;
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return false;
  const age = nowMs - created;
  return age >= (ANON_DRAFT_TTL_DAYS - ANON_DRAFT_REMINDER_DAYS_BEFORE) * DAY_MS && age < ANON_DRAFT_TTL_DAYS * DAY_MS;
}

/** The first REAL address the draft holds, or null when it holds none. */
export function draftReminderAddress(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const e = (c ?? '').trim();
    if (e && e.includes('@') && !isPlaceholderEmail(e)) return e;
  }
  return null;
}

/** When the sweep will delete it — the date the email names. */
export function draftDeletesOn(createdAtIso: string): Date {
  return new Date(Date.parse(createdAtIso) + ANON_DRAFT_TTL_DAYS * DAY_MS);
}

/** The words. Plain; they name the date and the one thing to do. */
export function draftReminderEmail(input: { createdAtIso: string; appUrl: string }): { subject: string; text: string } {
  const when = draftDeletesOn(input.createdAtIso).toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
  return {
    subject: 'Your Setnayan draft will be deleted soon',
    text: [
      `The event you started on Setnayan without an account will be deleted on ${when}.`,
      ``,
      `To keep it, create your free account — your plan stays exactly as you left it:`,
      `${input.appUrl}/signup`,
      ``,
      `If you'd rather let it go, you don't need to do anything.`,
      ``,
      `—`,
      `Setnayan · Plan, share and relive every celebration`,
    ].join('\n'),
  };
}

/** The `app_metadata` key that makes the reminder once per draft. */
export const DRAFT_REMINDER_SENT_KEY = 'draft_reminder_sent_at';
