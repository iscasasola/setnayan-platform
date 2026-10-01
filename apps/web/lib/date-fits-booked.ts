/**
 * date-fits-booked.ts — A DATE THAT CLASHES WITH A BOOKED SUPPLIER IS NOT OFFERED
 * AND NOT ACCEPTED (owner 2026-10-01, DECISION_LOG "A DATE THAT CLASHES WITH A
 * BOOKED SUPPLIER IS REFUSED AT THE PICK…", amended: "…GOES TO THE SUPPLIER IN
 * CONFLICT"): *"only follow the dates that complements. this is why we also
 * created builder compare"*.
 *
 * ONE availability check, and it is not new: `buildScheduleMatrix`
 * (lib/schedule-matrix.ts) reads each supplier's calendar through
 * `getBatchVendorAvailableDays` — the SAME primitive the supplier Compare reads
 * for its "booked that day" row — and marks a supplier `booked` on a day their
 * calendar blocks. This file only asks that matrix one more question: of the
 * BOOKED suppliers (`confirmed`, the set `eventDateRefusal` governs the date by),
 * is any of them booked on this day?
 *
 *   · "Help me choose" lists `fittingDates` only.
 *   · The draft's save refuses a day or month `clashesForMatrix` names, with
 *     `clashReason` — server-side (`lib/date-clash.server.ts`, called by
 *     `hubDraftAction`), so no door into the draft (typed, picked, month) can
 *     skip it. Apply's `eventDateRefusal` stays as the backstop.
 *
 * Honesty (the matrix's own): a supplier with no calendar on file never clashes,
 * and an off-platform one can't be checked — only a calendar that really blocks
 * the day is a clash.
 *
 * PURE and type-only imports: the Maker's date finder (a client component) and
 * the server read both use it.
 */
import type { MatrixDate, ScheduleMatrix } from './schedule-matrix';

/** A booked supplier that cannot do the picked day or month. */
export type DateClash = {
  /** `event_vendors.vendor_id` — the workspace route's id. */
  vendorId: string;
  name: string;
  /** "Photography", "Catering" … — the service label. */
  service: string;
  /** Where the couple asks them to move or unlock: that supplier's thread. */
  href: string;
};

export type ClashingVendor = { key: string; name: string; service: string };

/** Booked suppliers whose calendar blocks this day. */
export function bookedClashes(date: MatrixDate): ClashingVendor[] {
  const out: ClashingVendor[] = [];
  const seen = new Set<string>();
  for (const cat of date.categories) {
    for (const v of cat.vendors) {
      if (!v.confirmed || v.state !== 'booked' || seen.has(v.key)) continue;
      seen.add(v.key);
      out.push({ key: v.key, name: v.name, service: cat.label });
    }
  }
  return out;
}

/** Does every booked supplier have this day free (or no calendar to say otherwise)? */
export function fitsBookedSuppliers(date: MatrixDate): boolean {
  return bookedClashes(date).length === 0;
}

/** The days "Help me choose" may offer: only those that fit every booked supplier. */
export function fittingDates<T extends MatrixDate>(dates: readonly T[]): T[] {
  return dates.filter(fitsBookedSuppliers);
}

/**
 * The suppliers a pick clashes with — none when ANY candidate day of the pick
 * fits every booked supplier. A day is one column; a month (or year) is its
 * Saturdays, so a month "clashes" only when no Saturday in it works. When none
 * does, the suppliers named are those booked on the day with the fewest.
 */
export function clashesForMatrix(matrix: ScheduleMatrix): ClashingVendor[] {
  let best: ClashingVendor[] | null = null;
  for (const d of matrix.dates) {
    const clashes = bookedClashes(d);
    if (clashes.length === 0) return [];
    if (!best || clashes.length < best.length) best = clashes;
  }
  return best ?? [];
}

/**
 * The plain reason, naming the supplier by what they are to the couple (owner
 * 2026-10-01: *"Your photographer is booked elsewhere that day"*) — never a
 * database key, never a verdict on the couple's wedding.
 */
export function clashReason(services: readonly string[], precision: 'day' | 'month' | 'year'): string {
  const when = precision === 'day' ? 'that day' : precision === 'month' ? 'that month' : 'that year';
  const yours = services.map((s) => `your ${s.toLowerCase()}`);
  const who =
    yours.length === 0
      ? 'A supplier you booked'
      : yours.length === 1
        ? yours[0]!
        : `${yours.slice(0, -1).join(', ')} and ${yours[yours.length - 1]}`;
  return `${who[0]!.toUpperCase()}${who.slice(1)} ${yours.length > 1 ? 'are' : 'is'} booked elsewhere ${when}.`;
}
