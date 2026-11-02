/**
 * ✅ THE HOST SEES "CONFIRM MY TIMES" (supplier gate audit G6, 2026-11-02; owner "A SUPPLIER'S SCHEDULE BASICS FOR THIS
 * WEEK"). A booked supplier presses Seen (on a schedule change) or Confirm my times (the final week) — RPC
 * `supplier_mark_schedule`, one `event_supplier_schedule_marks` row per (event × shop). The supplier was told "The host
 * sees your times are final", and no host screen read the row. Now two places do, from this one rule:
 *   · Suppliers › Booked — the supplier's Team row ("✓ Times confirmed · Nov 2" / "Seen · Nov 2");
 *   · the Schedule — the moment's supplier line ("Kusina ni Lola · Booked · Times confirmed").
 * Confirmed wins over Seen (Confirm also sees). Read under the viewer's own RLS: the couple and Schedule helpers.
 */

export type ScheduleMarkFacts = { seenAt: string | null; confirmedAt: string | null };

/** The one word a host reads. */
export type TimesMark = 'Times confirmed' | 'Seen';

export function timesMarkOf(m: ScheduleMarkFacts | null | undefined): { word: TimesMark; at: string } | null {
  if (!m) return null;
  if (m.confirmedAt) return { word: 'Times confirmed', at: m.confirmedAt };
  if (m.seenAt) return { word: 'Seen', at: m.seenAt };
  return null;
}

/** "Nov 2" in Manila — the day the supplier pressed it. */
export function markDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** "Times confirmed · Nov 2" — the Team row's line. */
export function timesMarkLine(mark: { word: TimesMark; at: string }): string {
  const day = markDay(mark.at);
  return day ? `${mark.word} · ${day}` : mark.word;
}

/** Said on the Team row when the marks could not be read — never drawn as "not confirmed". */
export const TIMES_MARK_UNREAD = 'Could not check whether they confirmed their times.';

/** Rows of `event_supplier_schedule_marks` → by shop (`vendor_profile_id`). */
export function marksByShop(
  rows: ReadonlyArray<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null }>,
): Map<string, ScheduleMarkFacts> {
  return new Map(rows.map((r) => [r.vendor_profile_id, { seenAt: r.seen_at, confirmedAt: r.confirmed_at }]));
}
