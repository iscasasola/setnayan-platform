/**
 * 🧭 FIND'S "NEAREST" — which venue it measures from (owner 2026-10-30, on the Suppliers › Find sort: *"nearest means
 * it is compared to either their booked reception venue or ceremony venue … we make them choose?"* → "Reception +
 * Ceremony"). The rows go into the ONE shared ⇅ (`find-sort-menu.tsx`) as Sort rows — never a second control.
 *
 * 📍 NEAREST FROM — the two venues the Event Hub already resolves (`lib/event-venues.ts` `resolveEventVenues`: the
 * booked venue's pin first, else the couple's own pin). Only a venue with a pin is offered, and the same place twice
 * ("Ceremony & Reception") is ONE row. Nothing is geocoded; a place with no pin is never measured from.
 *
 * 💸 There is NO price range here (owner 2026-10-31, "SEVEN OWNER ANSWERS" (1): price is *"sort only"*). The
 * range sheet this file once fed was dropped; price is the ⇅'s "Lowest price" sort, which orders and removes nothing.
 *
 * Pure, so `find-sort-choices.test.ts` walks it.
 */
import type { EventVenue } from './event-venues';
import { LENSES } from './ranking-lenses';


export type NearFrom = 'reception' | 'ceremony';

export type NearPin = { latitude: number; longitude: number };

export type NearAnchors = { reception: NearPin | null; ceremony: NearPin | null };

const pinOf = (v: EventVenue): NearPin | null =>
  v.latitude != null && v.longitude != null && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)
    ? { latitude: v.latitude, longitude: v.longitude }
    : null;

/** The reception and ceremony pins, read off the resolved venues ("both" fills both). */
export function nearAnchors(venues: readonly EventVenue[]): NearAnchors {
  let reception: NearPin | null = null;
  let ceremony: NearPin | null = null;
  for (const v of venues) {
    const p = pinOf(v);
    if (!p) continue;
    if ((v.role === 'reception' || v.role === 'both') && !reception) reception = p;
    if ((v.role === 'ceremony' || v.role === 'both') && !ceremony) ceremony = p;
  }
  return { reception, ceremony };
}

const samePin = (a: NearPin, b: NearPin) =>
  Math.abs(a.latitude - b.latitude) < 0.0014 && Math.abs(a.longitude - b.longitude) < 0.0014;

/**
 * The "Nearest" rows the sort menu offers, in order. Two different pins → "Nearest to reception" and "Nearest to
 * ceremony"; one pin (or the same place twice) → one row, the shipped lens label, measured from it; none → none
 * (the menu keeps the lens greyed with its shipped reason).
 */
export function nearRows(a: NearAnchors): { from: NearFrom; label: string }[] {
  if (a.reception && a.ceremony && !samePin(a.reception, a.ceremony)) {
    return [
      { from: 'reception', label: 'Nearest to reception' },
      { from: 'ceremony', label: 'Nearest to ceremony' },
    ];
  }
  if (a.reception) return [{ from: 'reception', label: LENSES.near.label }];
  if (a.ceremony) return [{ from: 'ceremony', label: LENSES.near.label }];
  return [];
}

/** The place a "Nearest" sort measures from — the one asked for when it has a pin, else whichever does. */
export function nearFromOffered(asked: NearFrom, a: NearAnchors): NearFrom {
  if (asked === 'ceremony' ? a.ceremony : a.reception) return asked;
  return a.reception ? 'reception' : 'ceremony';
}

/** The menu key of a "Nearest" row (the sort itself stays the shipped `near` lens). */
export const nearKey = (from: NearFrom) => `near:${from}`;
export const nearFromKey = (key: string): NearFrom | null =>
  key === 'near:reception' ? 'reception' : key === 'near:ceremony' ? 'ceremony' : null;
