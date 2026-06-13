import { normalizeGuestName } from '@/lib/guest-name';

// Seat-finding PR 1 — shared helpers for the FREE guest "find your seat"
// lookup. The name matching + publication gate live in the SECURITY DEFINER
// public_seat_lookup() RPC (migration 20261213000000); these are the app-side
// input guards + types around it.

/** Minimum query length — refuse 0/1-char probes (anti roster-enumeration). */
export const SEAT_LOOKUP_MIN_LEN = 2;

/** Hard cap on returned matches (mirrors the RPC's LIMIT). */
export const SEAT_LOOKUP_MAX_MATCHES = 25;

export type SeatMatch = { display_name: string; table_label: string };

/**
 * Normalize + length-gate a raw seat-lookup query. Reuses normalizeGuestName
 * (NFC + invisible-char strip + whitespace fold) so the search matches the
 * same normalization every guest name is STORED under. Returns null when the
 * query is too short to answer — the route turns that into an empty result,
 * never a roster dump, and the client skips firing the request.
 */
export function sanitizeSeatLookupQuery(raw: string | null | undefined): string | null {
  const normalized = normalizeGuestName(raw);
  if (normalized.length < SEAT_LOOKUP_MIN_LEN) return null;
  return normalized;
}
