/**
 * ✅ THE HOST SEES "CONFIRM MY TIMES" (supplier gate audit G6, 2026-11-02; owner "A SUPPLIER'S SCHEDULE BASICS FOR THIS
 * WEEK"). A booked supplier presses Seen (on a schedule change) or Confirm my times (the final week) — RPC
 * `supplier_mark_schedule`, one `event_supplier_schedule_marks` row per (event × shop). The supplier was told "The host
 * sees your times are final", and no host screen read the row. Now two places do, from this one rule:
 *   · Suppliers › Booked — the supplier's Team row ("✓ Times confirmed · Nov 2" / "Seen · Nov 2");
 *   · the Schedule — the moment's supplier line ("Kusina ni Lola · Booked · Times confirmed").
 * Confirmed wins over Seen (Confirm also sees). Read under the viewer's own RLS: the couple and Schedule helpers.
 */

export type ScheduleMarkFacts = { seenAt: string | null; confirmedAt: string | null; lockedAt?: string | null };

/** The one word a host reads. 🔒 'Not taking changes' — the supplier's CHANGE LOCK (audit D7, migration 20271303409352),
 *  said in the host's words: a couple reads "book", never "lock" (owner d19; controller ruling 2026-11-02 — the supplier's
 *  own button and state keep the owner's term "Lock my times" / "Locked"). It is the strongest: while it stands, the
 *  database refuses the host's change to that supplier's moments — the host can only ask. */
export const NOT_TAKING_CHANGES = 'Not taking changes';
export type TimesMark = typeof NOT_TAKING_CHANGES | 'Times confirmed' | 'Seen';

export function timesMarkOf(m: ScheduleMarkFacts | null | undefined): { word: TimesMark; at: string } | null {
  if (!m) return null;
  if (m.lockedAt) return { word: NOT_TAKING_CHANGES, at: m.lockedAt };
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
  rows: ReadonlyArray<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null; locked_at?: string | null }>,
): Map<string, ScheduleMarkFacts> {
  return new Map(
    rows.map((r) => [r.vendor_profile_id, { seenAt: r.seen_at, confirmedAt: r.confirmed_at, lockedAt: r.locked_at ?? null }]),
  );
}

/** The columns every reader selects — one list, so a reader cannot drop the lock and draw a locked part as open. */
export const SCHEDULE_MARK_COLUMNS = 'vendor_profile_id, seen_at, confirmed_at, locked_at';

/** 🔒 The host's calm line when a change meets a locked part (the database says the same words). Host words: never "lock". */
export function lockedLine(shop: string): string {
  return `${lockedHead(shop)} Send them a request instead.`;
}

/** The first half alone — the moment sheet puts its own "Send them a request" button after it. */
export function lockedHead(shop: string): string {
  return `${shop} isn’t taking changes.`;
}
