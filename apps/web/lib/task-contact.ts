/**
 * 📇 A TASK'S CONTACT — a name and a phone for someone who is not a supplier (the bridal-car driver) (owner
 * 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (3); migration
 * 20271303218631).
 *
 * Shown ONLY to the host, the coordinator and that moment's crew — the database decides who reads it
 * (`event_schedule_task_contacts`, its own table because every booked supplier reads every task row). This module is
 * pure: the rules the form checks before a save (the column's CHECK checks them again) and the words it is shown in.
 */
export type TaskContact = { name: string; phone: string };

export const CONTACT_NAME_MAX = 80;
export const CONTACT_PHONE_MAX = 40;
const PHONE_SHAPE = /^[0-9+()./ -]+$/;

/** A phone as written — digits and the usual marks, 7 to 40 long. Never reformatted (it is shown as the host typed it). */
export function phoneProblem(raw: string): string | null {
  const p = raw.trim();
  if (p.length < 7) return 'Type the whole number.';
  if (p.length > CONTACT_PHONE_MAX) return 'That number is too long.';
  if (!PHONE_SHAPE.test(p)) return 'Only numbers, spaces, +, ( ) and dashes.';
  return null;
}

export function nameProblem(raw: string): string | null {
  const n = raw.trim();
  if (n.length === 0) return 'Type their name.';
  if (n.length > CONTACT_NAME_MAX) return `Keep it under ${CONTACT_NAME_MAX} letters.`;
  return null;
}

/**
 * What a save posts: both blank = remove the contact; both filled and valid = keep it; one without the other is not a
 * contact yet. Returns the reason in words when it cannot be kept.
 */
export function contactFrom(
  name: string,
  phone: string,
): { ok: true; contact: TaskContact | null } | { ok: false; error: string } {
  const n = name.trim();
  const p = phone.trim();
  if (!n && !p) return { ok: true, contact: null };
  const problem = nameProblem(n) ?? phoneProblem(p);
  if (problem) return { ok: false, error: problem };
  return { ok: true, contact: { name: n, phone: p } };
}

/** "Mang Ben · 0917 123 4567" — one line, as typed. */
export function contactLine(c: TaskContact): string {
  return `${c.name} · ${c.phone}`;
}

/** Rows read from `event_schedule_task_contacts` → by task, ignoring anything malformed. */
export function contactsByTask(rows: readonly { task_id?: unknown; name?: unknown; phone?: unknown }[]): Map<string, TaskContact> {
  const out = new Map<string, TaskContact>();
  for (const r of rows) {
    if (typeof r.task_id === 'string' && typeof r.name === 'string' && typeof r.phone === 'string') {
      out.set(r.task_id, { name: r.name, phone: r.phone });
    }
  }
  return out;
}
