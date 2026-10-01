/**
 * venue-chain.ts — the parish ⇄ reception chain, as pure rules (Lane 2).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "WE ALREADY HAVE OUR VENUE / PICKING A VENUE
 * IN ONBOARDING = A LIST OF WHAT IS FREE ON THEIR DATES — AND PARISH ↔
 * RECEPTION CHAIN"): each list shows suppliers free on at least one of the
 * couple's candidate dates, each row says WHICH of their dates; pick one and the
 * dates narrow to the ones it is free on; the other list is then the places
 * near it, nearest first, each with its distance.
 *
 * 🛑 DISTANCE IS KILOMETRES, NEVER A DRIVE TIME (owner 2026-10-01: *"don't
 * guess a number"*). A drive time needs a speed we have not measured; "nearby ≈
 * 15 minutes" therefore cannot become a cut-off here. The list is ordered
 * nearest first and the rest sits behind "Show farther options" — nothing is
 * hidden, and no number is invented to decide what is "near".
 *
 * "FREE" means NOT MARKED BUSY. A supplier with no Setnayan calendar is
 * "fully available" by the platform's V1 default (`getBatchVendorAvailableDays`),
 * so a ✓ here is "not booked on that day", never "confirmed free" — the card
 * says "Not booked on", and the supplier still answers.
 *
 * Pure and client-safe: no I/O (`haversineKm` is arithmetic).
 */

import { haversineKm } from '@/lib/geo';

/** One supplier as the lists draw it (server fills the data, this file orders it). */
export type VenueCandidate = {
  vendorId: string;
  name: string;
  city: string | null;
  photoUrl: string | null;
  verified: boolean;
  lat: number | null;
  lng: number | null;
  /** The couple's candidate dates (YYYY-MM-DD) this supplier is NOT marked busy on. */
  freeDates: readonly string[];
};

export type VenueRow = VenueCandidate & {
  /** Straight-line kilometres from the anchor, one decimal; null when either end has no pin. */
  km: number | null;
};

export type Anchor = { lat: number; lng: number };

/** How many rows a list shows before "Show farther options ›" (a page size, not a domain rule). */
export const VENUES_FIRST_PAGE = 5;

/** The suppliers free on at least one of `dates` — the engine's own rule, restated for the narrowed set. */
export function freeOnAny(c: Pick<VenueCandidate, 'freeDates'>, dates: readonly string[]): boolean {
  if (dates.length === 0) return true;
  return dates.some((d) => c.freeDates.includes(d));
}

/**
 * The dates that remain once a venue is picked: the couple's candidates that this
 * venue is not marked busy on. Never empty by accident — a pick that clears every
 * date (it can only be picked from a list already filtered to ≥ 1) keeps the
 * original dates rather than erasing the couple's answer.
 */
export function narrowDates(candidates: readonly string[], picked: Pick<VenueCandidate, 'freeDates'> | null): string[] {
  if (!picked) return [...candidates];
  const kept = candidates.filter((d) => picked.freeDates.includes(d));
  return kept.length > 0 ? kept : [...candidates];
}

/** Add the distance from the anchor (km, one decimal), or null. */
export function withDistance(cands: readonly VenueCandidate[], anchor: Anchor | null): VenueRow[] {
  return cands.map((c) => ({
    ...c,
    km:
      anchor && c.lat != null && c.lng != null
        ? Math.round(haversineKm(anchor.lat, anchor.lng, c.lat, c.lng) * 10) / 10
        : null,
  }));
}

/** Nearest first; a supplier with no pin goes last and keeps its incoming order (stable). */
export function nearestFirst(rows: readonly VenueRow[]): VenueRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.km == null && b.r.km == null) return a.i - b.i;
      if (a.r.km == null) return 1;
      if (b.r.km == null) return -1;
      return a.r.km - b.r.km || a.i - b.i;
    })
    .map(({ r }) => r);
}

/** Case-insensitive "search by name" — whitespace-trimmed; empty keeps everything. */
export function searchByName<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows];
}

/**
 * The list the couple sees for one role, given what they have already picked.
 * `anchor` is the OTHER venue's pin once one is chosen (then ordered nearest
 * first, each with its km); before that it is the area's centre, which only
 * orders the list — a venue is never dropped for being far.
 */
export function chainedList(input: {
  all: readonly VenueCandidate[];
  dates: readonly string[];
  anchor: Anchor | null;
}): VenueRow[] {
  const free = input.all.filter((c) => freeOnAny(c, input.dates));
  return nearestFirst(withDistance(free, input.anchor));
}

/** The "Dec 18 ✓ Dec 19 ✓ Dec 26 —" strip: one entry per candidate date. */
export function freeStrip(
  dates: readonly string[],
  c: Pick<VenueCandidate, 'freeDates'>,
): Array<{ date: string; free: boolean }> {
  return dates.map((date) => ({ date, free: c.freeDates.includes(date) }));
}
