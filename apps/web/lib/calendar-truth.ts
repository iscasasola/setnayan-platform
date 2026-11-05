/**
 * calendar-truth.ts — ONE answer to "can this supplier take our day?", the same on both ends (owner 2026-10-10, P5
 * "calendar truth": *"Not set", never "Free"*; corpus `SUPPLIER_CONNECTION_MAP_2026-10-10.md` rows 30–31).
 *
 * ── WHAT WAS WRONG (row 30, measured in code) ──────────────────────────────────────────────────────────────────────
 * The couple's "Free on your date" read `vendor_calendar_blocks` ONLY (`getBatchVendorAvailableDays`), and a supplier
 * with no calendar at all read "Free" — "undeclared calendar = fully available". Meanwhile the lock refuses a day on a
 * closure, the shop's own hard hold, a full calendar (pool) or a full time slot (`service_cards_unbookable_on`, H6's
 * mirror of `acquire_schedule_pools`). So a supplier whose day was full was hidden from "More to compare" yet read
 * "Free on your date" on the card, and a freshly invited supplier with an empty calendar read "Free" to every couple.
 *
 * ── THE ONE RULE (both ends) ───────────────────────────────────────────────────────────────────────────────────────
 *   Booked   the lock itself would refuse the day: every bookable card of theirs is refused on it — the same refusal
 *            that marks the supplier's own Dates day Blocked (closure · their hold) or full;
 *   Not set  they have no calendar yet — no schedule pool (the supplier's Dates says "Not set" by the same test,
 *            `capacityLine` on S-PR3), so nothing can be said about the day: never "Free";
 *   Free     a calendar exists and the lock would take the day.
 * A read that failed says NOTHING (no badge) — never "Free", never "Booked".
 *
 * Pure; the read is `calendar-truth.server.ts`. Every couple surface that names a day's fit (the card badge, the
 * sheet's fit line, Build's "N of M priced picks are free", Help me choose) reads this one type.
 */

export type DateFit = 'free' | 'booked' | 'not_set';

/** The word for a calendar the supplier never set — the same word their own Dates prints (S-PR3 `capacityLine`). */
export const CALENDAR_NOT_SET = 'Not set';

/** The couple's words for each fit, on a card and in the sheet. */
export const DATE_FIT_WORDS: Record<DateFit, string> = {
  free: 'Free on your date',
  booked: 'Booked that day',
  not_set: `Calendar ${CALENDAR_NOT_SET.toLowerCase()}`,
};

/** What a supplier's calendar says about the days asked (`calendar-truth.server.ts`). */
export type CalendarTruth = {
  /** The supplier has a calendar — at least one schedule pool. */
  set: boolean;
  /** The days asked that the lock would refuse them on. */
  refused: ReadonlySet<string>;
};

/** One supplier on one day. Refused wins over "not set": a closure the shop typed is a fact even without a pool. */
export function dateFitOf(truth: CalendarTruth | undefined, day: string): DateFit | null {
  if (!truth) return null;
  if (truth.refused.has(day)) return 'booked';
  if (!truth.set) return 'not_set';
  return 'free';
}

/**
 * The supplier ids the lock would refuse on EVERY day asked — from the RPC's card × day refusals. A supplier with no
 * bookable card is never judged (the search matched them by profile, not by a card that can be booked).
 */
export function refusedDaysBySupplier(
  cardsBySupplier: ReadonlyMap<string, readonly string[]>,
  refusals: ReadonlyArray<{ service_id: string | null; refused_on: string | null }>,
  days: readonly string[],
): Map<string, Set<string>> {
  const refusedCards = new Map<string, Set<string>>();
  for (const r of refusals) {
    if (!r.service_id || !r.refused_on) continue;
    const s = refusedCards.get(r.refused_on) ?? new Set<string>();
    s.add(r.service_id);
    refusedCards.set(r.refused_on, s);
  }
  const out = new Map<string, Set<string>>();
  for (const [supplier, cards] of cardsBySupplier) {
    const refused = new Set<string>();
    if (cards.length > 0) {
      for (const day of days) {
        const onDay = refusedCards.get(day);
        if (onDay && cards.every((c) => onDay.has(c))) refused.add(day);
      }
    }
    out.set(supplier, refused);
  }
  return out;
}
