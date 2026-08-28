/**
 * How long a couple has been waiting for a vendor's reply, in words.
 *
 * Design § 2.4 EXTEND 1 — a vendor looking at their list should be able to see
 * which couple has been left longest without opening anything, because that is
 * the one most likely to book someone else.
 *
 * 🔑 ON EVERY ROW OF THE ANSWERS DESK, CORRECTED 2026-08-27. This said
 * "ENQUIRIES ONLY, ON PURPOSE … putting an age on those would invent an SLA
 * nobody agreed to", and it was already untrue when it was read — the booking
 * ask and the deletion ask had both been carrying it for weeks. It is also the
 * wrong rule now: the feed is sorted OLDEST WAITING FIRST, so the age is not a
 * promised reply time, it is the REASON a row sits where it sits. Hiding it left
 * a supplier unable to see why one card was above another.
 *
 * 🪤 THIS IS AN ELAPSED DURATION, NOT A CALENDAR DIFFERENCE, so it is computed
 * in milliseconds and never by comparing dates. "Waiting 2 days" across a
 * timezone boundary must not become 1 or 3 because two civil dates were
 * subtracted — a mistake this repo has shipped before in the other direction
 * (a wall clock compared against an instant, 17 live defects in one day).
 *
 * 🪤 A FUTURE TIMESTAMP IS CLOCK SKEW, NOT NEGATIVE WAITING. It clamps to "just
 * now" rather than rendering "waiting -3 h", which would look like a bug to the
 * one person who must trust this number.
 */

export type WaitingAge = {
  /** "just now" · "waiting 2 h" · "waiting 3 days" */
  label: string;
  /** True past 24 h — the point the design tints it as overdue. */
  overdue: boolean;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function waitingAge(createdAtIso: string, now: number): WaitingAge | null {
  const started = Date.parse(createdAtIso);
  if (!Number.isFinite(started)) return null; // unparseable — say nothing at all
  const elapsed = now - started;
  if (elapsed < 0) return { label: 'just now', overdue: false }; // clock skew
  if (elapsed < HOUR) return { label: 'just now', overdue: false };
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return { label: `waiting ${hours} h`, overdue: false };
  }
  const days = Math.floor(elapsed / DAY);
  return { label: `waiting ${days} ${days === 1 ? 'day' : 'days'}`, overdue: true };
}
