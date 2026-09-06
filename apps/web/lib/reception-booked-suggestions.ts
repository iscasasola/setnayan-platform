/**
 * "You've booked them — add them to your room?"
 *
 * Owner ruling 2026-09-06 (Q9): when a couple has BOOKED a live band, a mobile
 * bar or a photo booth, the reception zone that would show it **SUGGESTS** it.
 * It never writes it.
 *
 * 🔑 THE RULING IS ENFORCED BY THE RETURN TYPE, NOT BY DISCIPLINE. This module
 * cannot produce a `ReceptionDesign` — it does not import one and its result
 * carries no option ids at all, only *which zone* and *which supplier*. A later
 * edit that decides to "just apply it" has to change the shape of this file to
 * do it, which is a visible act rather than a quiet one.
 *
 * Why that matters: `sel()` falls back to `DEFAULT_DESIGN` for any part a stored
 * design has no key for, so writing a suggestion in is indistinguishable from a
 * choice the couple made. They would find selections they never made, and
 * deleting one could not stick — the next page load would put it back. The same
 * reasoning made every celebration zone default to `none`.
 *
 * 🔑 AND THERE IS NO SECOND MAPPING. The zone→trade question is already
 * answered by `canonicalServicesForPart` (moodboard-finalization.ts), which is
 * what the Ask button and the finalization screen use. A supplier's own
 * `vendor_profiles.services` is already in the same canonical vocabulary. So a
 * suggestion is an INTERSECTION of two things the page already loads — not a
 * new opinion about which vendor belongs where.
 */

import type { PartId } from './reception-scene';
import { canonicalServicesForPart } from './moodboard-finalization';

/** A confirmed supplier, in the shape the mood-board page already selects:
 *  `event_vendors` joined to `vendor_profiles ( services )`. */
export type BookedSupplier = {
  vendorId: string;
  vendorName: string;
  /** Canonical service keys from `vendor_profiles.services`. */
  services: readonly string[];
};

/** One zone, and the suppliers the couple has already booked who work in it.
 *  Deliberately carries NO option id — see the note at the top of this file. */
export type ZoneSuggestion = {
  zone: PartId;
  suppliers: { vendorId: string; vendorName: string }[];
};

/**
 * Which of the couple's booked suppliers belong to each zone.
 *
 * Total and pure: unknown zones, suppliers with no services, and an empty
 * booking list all produce an empty result rather than an error. A zone with no
 * matching supplier is ABSENT from the output — callers render nothing for it,
 * which is what the room does today.
 *
 * `zones` is passed in rather than derived so the caller can pass only the
 * zones it is actually showing (the venue-applicable ones), and so this
 * function never has to know about `venueZoneApplies`.
 */
export function suggestZonesFromBookings(
  booked: readonly BookedSupplier[],
  zones: readonly PartId[],
): ZoneSuggestion[] {
  const out: ZoneSuggestion[] = [];
  for (const zone of zones) {
    // 🪤 THE PART-ID NAMESPACE IS `room:<zone>`, NOT THE BARE ZONE ID.
    // `canonicalServicesForPart('program')` returns an EMPTY list — not an
    // error — because the render-part vocabulary prefixes room zones (the same
    // keys `MOODBOARD_PART_TRADES` uses: `room:walls`, `room:feast`, …). The
    // first version of this file passed the bare id and produced zero
    // suggestions for every couple, silently and with nothing failing: an
    // empty result is exactly what "this couple booked nobody for this zone"
    // looks like. Caught by running it on real bookings, not by a type.
    const wanted = new Set(canonicalServicesForPart(`room:${zone}`));
    if (wanted.size === 0) continue;
    const seen = new Set<string>();
    const suppliers: { vendorId: string; vendorName: string }[] = [];
    for (const s of booked) {
      if (!s.vendorId || seen.has(s.vendorId)) continue;
      if (!s.services.some((svc) => wanted.has(svc))) continue;
      seen.add(s.vendorId);
      suppliers.push({ vendorId: s.vendorId, vendorName: s.vendorName });
    }
    if (suppliers.length > 0) out.push({ zone, suppliers });
  }
  return out;
}

/** The one sentence a zone shows. Kept here so the wording is guarded with the
 *  logic, and so it can never read as though the room has already changed. */
export function suggestionLine(s: ZoneSuggestion): string {
  const names = s.suppliers.map((v) => v.vendorName).filter(Boolean);
  if (names.length === 0) return '';
  const who =
    names.length === 1
      ? names[0]!
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  // "You've booked X" — a statement about their BOOKINGS, never about their
  // room. The verb the couple acts on stays in the button, not in this line.
  return `You've booked ${who}`;
}
