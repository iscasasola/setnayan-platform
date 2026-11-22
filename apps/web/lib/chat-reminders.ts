/**
 * ⏰ UNICHAT PART H1 — "Remind me" on a chat message: the pure half (approved Unichat prototype v3, DECISION_LOG
 * 2026-11-20 — "… voice notes, reminders …").
 *
 * A person sets a reminder on one message they can read: LATER TODAY · TOMORROW · A DATE. It comes back as an in-app
 * notification (`chat_reminder` — never an email; owner rule 2026-10-11), to them alone.
 *
 * ⚠ THE TIMES BELOW ARE THIS BUILD'S CHOICE — the drawing names the three choices and no clock time:
 *   later today → 3 hours from now · tomorrow / a date → 9:00 AM, Manila (the product's zone, as in `formatChatTimestamp`).
 * They live here and only here, so a ruling changes one line. Asked of the owner in the PR.
 *
 * `lib/chat-message-calls.ts` works the time out with this function when the choice is pressed; the DATABASE's insert
 * policy re-checks it on its own clock (not in the past, at most 366 days on). The menu calls the same function to
 * print what a choice means before it is pressed. Held by `lib/chat-reminders.test.ts`.
 */

export type ReminderChoice = 'later' | 'tomorrow' | 'date';

export const REMINDER_LATER_HOURS = 3;
/** 9:00 AM in Manila is 01:00 UTC — Manila keeps no daylight time. */
export const REMINDER_MORNING_HOUR_MANILA = 9;
const MANILA_OFFSET_HOURS = 8;
/** A reminder is set at most this far ahead (the table's own policy allows 366). */
export const REMINDER_MAX_DAYS = 365;

const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-11-20" — today's date in Manila. */
export function manilaDayKey(nowMs: number): string {
  return DAY_KEY.format(new Date(nowMs));
}

function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The morning of a Manila calendar day, as an instant. */
function manilaMorning(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, REMINDER_MORNING_HOUR_MANILA - MANILA_OFFSET_HOURS);
}

/** The first and last day the date field offers: tomorrow … a year out (Manila days). */
export function reminderDateBounds(nowMs: number): { min: string; max: string } {
  const today = manilaDayKey(nowMs);
  return { min: addDays(today, 1), max: addDays(today, REMINDER_MAX_DAYS) };
}

export type ReminderWhen = { ok: true; at: number } | { ok: false; message: string };

export const REMINDER_PICK_A_DATE = 'Pick a date from tomorrow on, within a year.';

/** When a choice means, from `nowMs`. A date must be a real day from tomorrow to a year out. */
export function reminderWhen(choice: ReminderChoice, nowMs: number, dateKey?: string | null): ReminderWhen {
  if (choice === 'later') return { ok: true, at: nowMs + REMINDER_LATER_HOURS * 60 * 60 * 1000 };
  if (choice === 'tomorrow') return { ok: true, at: manilaMorning(addDays(manilaDayKey(nowMs), 1)) };
  const key = (dateKey ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return { ok: false, message: REMINDER_PICK_A_DATE };
  // A real day (2026-02-31 is not one): it must read back the same.
  if (addDays(key, 0) !== key) return { ok: false, message: REMINDER_PICK_A_DATE };
  const { min, max } = reminderDateBounds(nowMs);
  if (key < min || key > max) return { ok: false, message: REMINDER_PICK_A_DATE };
  return { ok: true, at: manilaMorning(key) };
}

export function isReminderChoice(v: unknown): v is ReminderChoice {
  return v === 'later' || v === 'tomorrow' || v === 'date';
}

/** What the notice says the message was — its first words, or what kind of thing it is. Never empty. */
export function reminderPreview(m: { body?: string | null; attachment_name?: string | null; attachment_mime?: string | null; voice_seconds?: number | null }): string {
  const words = (m.body ?? '').trim();
  if (words) return words.length > 140 ? `${words.slice(0, 139)}…` : words;
  if ((m.attachment_mime ?? '').toLowerCase().startsWith('audio/')) return 'A voice note';
  if (m.attachment_name) return `A file · ${m.attachment_name}`;
  return 'A message in this chat';
}

export const CHAT_REMINDER_TITLE = 'You asked to be reminded';
export const CHAT_REMINDERS_NOT_LOADED = 'Couldn’t load your reminder. Try again.';
export const CHAT_REMINDER_NOT_SET = 'Couldn’t set the reminder. Try again.';
export const CHAT_REMINDER_NOT_REMOVED = 'Couldn’t remove the reminder. Try again.';
