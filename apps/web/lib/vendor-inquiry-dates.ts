/**
 * vendor-inquiry-dates.ts — the dates couples are ASKING a vendor about, counted
 * per day, so the vendor's own calendar can show the question next to the answer.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Owner, 2026-08-08: *"we always check their schedule before they show. it needs
 * to be available on their schedules."*
 *
 * The first half is already true and has been for a long time:
 * `getBatchVendorAvailableDays` is the one shared availability path, consumed by
 * nine surfaces (Explore, the couple's vendor list, date selection, the plan
 * builder, compatibility scoring…), so a couple never sees a vendor without that
 * vendor's schedule being consulted. **A second, per-enquiry "is my date free?"
 * derivation was designed and CANCELLED for exactly that reason** — two answers
 * to one question can disagree, and the existing one already fails the safe way
 * ("a calendar flake reads free, never a false booked").
 *
 * The second half was the real gap. A vendor's calendar shows six things —
 * blocked, held, approve-first, full, booked, waitlisted — and **none of them is
 * "a couple is asking about this date."** Enquiries lived only in a list, so a
 * vendor answering one had the answer sitting on another screen, in a calendar
 * that did not know the question had been asked.
 *
 * ── THE PRIVACY RULE THIS MODULE MUST NOT BREAK ─────────────────────────────
 * ⚠ A pending enquiry is PRE-ACCEPT. The couple's identity is withheld until the
 * vendor accepts, and `buildInquiryCard` enforces that BY CONSTRUCTION — it has
 * no `displayName`/`venue`/`contact` parameter, so identity cannot enter a card
 * even by mistake. This module takes the same posture: it accepts only a date and
 * emits only a COUNT. There is no field here that could carry a name, so the
 * calendar cannot become a way around the mask.
 *
 * 🔑 A DATE WITH NO ENQUIRY AND A DATE WE COULD NOT READ MUST NOT LOOK ALIKE —
 * so a thread with a null date is DROPPED rather than bucketed anywhere. An
 * enquiry whose date is unknown is not an enquiry "about today"; it simply has no
 * place on a calendar, and inventing one would put a marker on a day nobody asked
 * about.
 */

/** The minimum shape this needs from a vendor thread — nothing identifying. */
export type InquiryDateInput = {
  /** 'pending' is the only pre-accept state that counts as an open question. */
  inquiry_status?: string | null;
  event?: { event_date?: string | null } | null;
};

export type InquiryDateCount = {
  /** 'YYYY-MM-DD' — the day the couple is asking about. */
  requestedDate: string;
  /** How many pending enquiries name this date. Never identity. */
  count: number;
};

/** `2026-12-12` — anything else is not a civil date and is dropped. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function pendingInquiryDates(threads: readonly InquiryDateInput[]): InquiryDateCount[] {
  const byDate = new Map<string, number>();
  for (const t of threads) {
    if (t?.inquiry_status !== 'pending') continue;
    const raw = t.event?.event_date ?? null;
    if (!raw) continue;
    // A timestamp can reach this column; take the civil day and never re-parse
    // it through `new Date`, which would shift the day west of Greenwich.
    const day = String(raw).slice(0, 10);
    if (!ISO_DAY.test(day)) continue;
    byDate.set(day, (byDate.get(day) ?? 0) + 1);
  }
  return [...byDate.entries()]
    .map(([requestedDate, count]) => ({ requestedDate, count }))
    .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate));
}
