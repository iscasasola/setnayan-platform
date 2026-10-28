/**
 * MESSENGER'S RHYTHM IN A THREAD (chat prototype 2026-10-28, frame B) — which bubbles join into a run, and where a
 * centred time sits. Pure, so the stream and its test read one rule.
 *
 *   • a RUN is consecutive plain messages from the same side with no quiet gap between them — their inside corners
 *     join, and the other side's small avatar sits beside the LAST bubble of their run only;
 *   • a TIME sits centred before the first message, and before any message that follows a quiet gap
 *     ({@link QUIET_GAP_MS}) — so the time is said once per stretch of talk, never on every bubble.
 *
 * A card (quote, meeting, change, amendment) or a Setnayan system line breaks a run: it is not a bubble.
 */

export const QUIET_GAP_MS = 15 * 60 * 1000;

export type RunRow = {
  sender_role: string;
  created_at: string;
  proposal_id?: string | null;
  appointment_id?: string | null;
  change_order_id?: string | null;
  amendment_id?: string | null;
};

function isBubble(r: RunRow): boolean {
  return !r.proposal_id && !r.appointment_id && !r.change_order_id && !r.amendment_id && r.sender_role !== 'system';
}

function gap(a: RunRow, b: RunRow): number {
  return Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Is there a centred time before row `i`? */
export function timeBreakBefore(rows: readonly RunRow[], i: number): boolean {
  if (i <= 0) return true;
  const prev = rows[i - 1];
  const cur = rows[i];
  if (!prev || !cur) return true;
  return gap(prev, cur) >= QUIET_GAP_MS;
}

function joins(a: RunRow | undefined, b: RunRow | undefined): boolean {
  if (!a || !b) return false;
  return isBubble(a) && isBubble(b) && a.sender_role === b.sender_role && gap(a, b) < QUIET_GAP_MS;
}

/** Where row `i` sits in its run. A lone bubble is both first and last. */
export function bubbleRun(rows: readonly RunRow[], i: number): { first: boolean; last: boolean } {
  return { first: !joins(rows[i - 1], rows[i]), last: !joins(rows[i], rows[i + 1]) };
}
