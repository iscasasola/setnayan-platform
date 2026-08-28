import type { PoolBookingEntry } from '@/lib/vendor-schedule';

/**
 * "IS THIS SHOP BOOKED ON THIS EVENT?" — the DECISION, with no database attached.
 *
 * Split out of `vendor-room-access.ts` (which is `server-only`, so it cannot be
 * imported by a test in this repo — `server-only` is not an installed package;
 * Next aliases it at build time and plain node cannot resolve it) for the same
 * reason `papic-uploads-open-rule.ts` was split out of its own IO wrapper: the
 * part worth proving is which bookings are admitted and on what day, and that
 * part is pure.
 *
 * ⚠ `scripts/lint-server-only-boundary.mjs` says in its own docblock that "the
 * unit tests import modules directly in node, where server-only resolves
 * happily". That is not true today — it throws MODULE_NOT_FOUND — which is
 * exactly why this split, and the eight other files like it, exist.
 *
 * ── THE TEST IS ALWAYS: DID THE SHOP ITSELF SAY YES? ────────────────────────
 * `event_vendors_couple_write` is `FOR ALL` with no column list, so a couple
 * writes that table through their own session and can type any shop's name and
 * set `contracted`. STATUS ALONE PROVES NOTHING. Two facts a couple cannot
 * manufacture do:
 *
 *   • ARM 2 · `lock_request_state = 'agreed'`.
 *     `guard_event_vendor_lock_handshake` raises 42501 when `authenticated` or
 *     `anon` writes that value — on INSERT (a row born 'agreed') and on UPDATE.
 *     Read out of production, not out of the migration that created it.
 *
 *   • ARM 3 · a CLAIMED Locked QR token issued by this shop.
 *     `vendor_locked_qr_tokens` carries one non-admin policy —
 *     `vendor_profile_id IN current_vendor_profile_ids()` — so no couple can
 *     write one, and `claimed_event_vendor_id` is stamped only by the SECURITY
 *     DEFINER claim RPC.
 *     🔒 A SHOP *CAN* WRITE ITS OWN TOKEN ROWS, so the token alone is not the
 *     proof. The candidate set handed in here is already scoped in SQL to rows
 *     whose `marketplace_vendor_id` is this shop, so a hand-made token pointed
 *     at somebody else's booking matches no candidate. Two sides, one booking.
 *
 * ── WHY A DAY-PRECISION DATE IS REQUIRED ───────────────────────────────────
 * A pool booking carries its own `booked_date`. An `event_vendors` row carries
 * no date at all, so arms 2 and 3 take it from `events.event_date` — and that
 * column holds a value even when `event_date_precision` is 'year', where it is
 * a placeholder the couple has not settled. Production holds such a row today
 * (4 events at 'day', 1 at 'year'). Without this filter a supplier would be
 * handed a full day-of console on a date nobody has agreed to.
 * `vendor_agree_to_lock` already gates its own same-date rules on
 * `precision = 'day'`; this matches it rather than inventing a rule.
 * ⚠ The date is compared as a STRING everywhere (`YYYY-MM-DD` against
 * `phToday()`). Never build a `Date` from it: `new Date('2026-12-12')` is
 * midnight UTC, which is the 11th in Manila.
 */

/**
 * One event this shop is booked on, in the shape the day-of screens already
 * consume. `poolBookingId` / `poolId` are null for a booking that holds no
 * schedule-pool row (arms 2 and 3) — no day-of caller reads either field;
 * every caller that does was deliberately left on `fetchVendorPoolBookings`.
 */
export type VendorRoomEvent = Omit<PoolBookingEntry, 'poolBookingId' | 'poolId'> & {
  poolBookingId: string | null;
  poolId: string | null;
  /** Which arm admitted this booking — for logs, tests and honest copy. */
  via: 'schedule_pool' | 'lock_agreed' | 'locked_qr';
  /** `event_vendors.vendor_id` for arms 2 and 3; null for a pool row. */
  eventVendorId: string | null;
};

/** Rows the room read needs off `event_vendors`, admin-scoped to one shop. */
export type BookingRow = {
  vendor_id: string;
  event_id: string;
  lock_request_state: string | null;
};

/** The `events` fields arms 2 and 3 need to place a booking on a calendar day. */
export type RoomEventRow = {
  display_name: string | null;
  event_date: string | null;
  event_date_precision: string | null;
};

/**
 * THE DECISION, WITH NO I/O IN IT — which candidate bookings become room
 * entries, and on what day. Pure so the rule can be proved without a database
 * and without rendering; every caller of this module goes through it.
 *
 * `candidates` are already scoped in SQL to rows that NAME this shop
 * (`marketplace_vendor_id`), carry a booked status, and are not archived.
 * This function decides the two remaining questions: did the SHOP say yes, and
 * is there a settled calendar day to be booked on.
 */
export function admitRoomBookings(
  candidates: readonly BookingRow[],
  claimedEventVendorIds: ReadonlySet<string>,
  eventById: ReadonlyMap<string, RoomEventRow>,
  threadByEvent: ReadonlyMap<string, string>,
): VendorRoomEvent[] {
  const out: VendorRoomEvent[] = [];
  for (const row of candidates) {
    // ARM 2 — the supplier pressed Agree. Unforgeable by the couple:
    // guard_event_vendor_lock_handshake raises 42501 when authenticated/anon
    // writes this value, on INSERT and on UPDATE.
    // ARM 3 — the couple claimed a Locked QR this shop issued. The token row is
    // vendor-and-admin-only by RLS, and the booking row independently names
    // this shop, so neither side can manufacture it alone.
    const via: VendorRoomEvent['via'] | null =
      row.lock_request_state === 'agreed'
        ? 'lock_agreed'
        : claimedEventVendorIds.has(row.vendor_id)
          ? 'locked_qr'
          : null;
    if (via === null) continue;

    const ev = eventById.get(row.event_id);
    // No settled calendar day ⇒ no day to be booked on. See the header.
    if (!ev || !ev.event_date || ev.event_date_precision !== 'day') continue;

    out.push({
      poolBookingId: null,
      poolId: null,
      eventId: row.event_id,
      bookedDate: ev.event_date,
      eventName: ev.display_name ?? 'A Setnayan event',
      threadId: threadByEvent.get(row.event_id) ?? null,
      via,
      eventVendorId: row.vendor_id,
    });
  }
  return out;
}

/**
 * One entry per (event, date). A shop can legitimately hold several pool slots
 * on one event AND an agreed row for the same event; the day-of screens want a
 * single answer. The FIRST entry wins, and arm 1 is always pushed first, so a
 * pool booking keeps its `poolId` rather than being replaced by a null one.
 * Dedupe is on (event, date) rather than event alone so a multi-day
 * celebration keeps every day it is booked for.
 */
export function dedupe(entries: VendorRoomEvent[]): VendorRoomEvent[] {
  const seen = new Map<string, VendorRoomEvent>();
  for (const e of entries) {
    const key = `${e.eventId}::${e.bookedDate}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()].sort((a, b) => a.bookedDate.localeCompare(b.bookedDate));
}
