import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_VENDOR_STATUSES } from '@/lib/vendors';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import {
  admitRoomBookings,
  dedupe,
  type BookingRow,
  type RoomEventRow,
  type VendorRoomEvent,
} from '@/lib/vendor-room-access-rule';

export type {
  VendorRoomEvent,
  BookingRow,
  RoomEventRow,
} from '@/lib/vendor-room-access-rule';

/**
 * ONE HONEST ANSWER TO "IS THIS SHOP BOOKED ON THIS EVENT?"
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Every day-of screen asked the schedule pool — `vendor_schedule_pool_bookings`
 * where `released_at IS NULL`. Measured against production (`pg_proc`, not a
 * migration file and not a comment): the pool table has exactly ONE writer,
 * `acquire_schedule_pools`, and that function has exactly ONE caller,
 * `acquire_service_time_slot`. So a booking made by any OTHER path holds no
 * pool row at all, and every screen that asks the pool reports NOT BOOKED.
 *
 * Two shipped paths book without touching the pool, and both were invisible:
 *
 *   1. `vendor_agree_to_lock` — the supplier pressed Agree. It writes
 *      `lock_request_state = 'agreed'` and `status = 'contracted'` in one
 *      statement and acquires nothing. So a supplier who said yes and is
 *      waiting on the couple to record the downpayment was told they had no
 *      event, on the morning of the wedding they had agreed to shoot.
 *
 *   2. `vendor_claim_locked_qr` — the couple scanned the shop's Locked QR.
 *      It writes `status = 'deposit_paid'`, records the downpayment already
 *      received off-platform, and acquires nothing. MONEY HAS ALREADY MOVED
 *      and the supplier was still invisible.
 *
 * ⛔ IT DOES NOT WRITE `lock_request_state` AT ALL — verified by reading the
 *    live function body out of production, not the migration that created it.
 *    The build note for this piece specified arm 2 alone (`'agreed'`), which
 *    catches (1) and MISSES (2) completely. A filter that cannot match is not
 *    a fix; it is the same green-and-wrong shape this repo keeps paying for.
 *    That is why there is a third arm below.
 *
 * ── WHAT COUNTS AS BOOKED, AND WHY EACH ARM IS UNFORGEABLE ─────────────────
 * The test is always: DID THE SHOP ITSELF DO SOMETHING THAT SAYS YES? A couple
 * writes `event_vendors` through their own session (`event_vendors_couple_write`
 * is `FOR ALL` with no column list), so status alone proves nothing — a couple
 * can type any shop's name and set `contracted`.
 *
 *   • ARM 1 · the schedule pool. Unchanged, and read through the CALLER'S OWN
 *     client exactly as before, so nothing about today's behaviour moves.
 *
 *   • ARM 2 · `lock_request_state = 'agreed'`.
 *     `guard_event_vendor_lock_handshake` raises 42501 when `authenticated` or
 *     `anon` sets that value — on INSERT (a row born 'agreed') and on UPDATE.
 *     Read out of production. Only the vendor-side RPCs can write it.
 *
 *   • ARM 3 · a CLAIMED Locked QR token issued by this shop.
 *     `vendor_locked_qr_tokens` carries one policy for non-admins —
 *     `vendor_profile_id IN current_vendor_profile_ids()` — so no couple can
 *     write a claimed token, and `claimed_event_vendor_id` is stamped only by
 *     the SECURITY DEFINER claim RPC.
 *     🔒 A shop CAN write its own token rows, so the token alone is not the
 *     proof: arm 3 additionally requires the `event_vendors` row to name this
 *     shop in `marketplace_vendor_id`. Two sides, one booking. A shop pointing
 *     a hand-made token at somebody else's booking matches nothing.
 *
 * Arms 2 and 3 both additionally require a real booked status
 * (`BOOKED_VENDOR_STATUSES`, IMPORTED from `lib/vendors` — the typed copy; a
 * second, untyped copy of the same four strings lives in
 * `lib/event-deletion-gate.ts` and is deliberately not the one used here) and
 * `archived_at IS NULL`.
 *
 * ── ID IN, CLIENT IN. NO SESSION RESOLUTION INSIDE. ────────────────────────
 * 🔑 NOT A STYLE CHOICE. `on-the-day/live/[eventId]/page.tsx` has a GRANTEE
 * path that passes an admin client and a vendor id derived from an access
 * GRANT — the caller is a crew member, not the shop. A helper that resolved
 * the shop from the session would break that role silently.
 *
 * ── WHY ARMS 2 AND 3 READ WITH THE SERVICE ROLE ────────────────────────────
 * `event_vendors` has FOUR policies and not one of them is vendor-side: couple
 * write, couple read, moderator write, moderator read. A supplier reading that
 * table through their own session gets ZERO ROWS, silently, forever — RLS
 * denial and an empty result are the same value. So the authorization read is
 * scoped in SQL by the `vendorProfileId` the caller proved, using the admin
 * client, which is the shape `fetchVendorPoolBookings` already uses for the
 * event-name lookup it cannot do under vendor RLS.
 * 🔒 This is an AUTHORIZATION read — who is booked. It returns no event
 * content. Event content (the run-of-show, the guest list) must keep going
 * through `get_vendor_event_brief` under the supplier's own session.
 *
 * ── WHY A DAY-PRECISION DATE IS REQUIRED ───────────────────────────────────
 * A pool booking carries its own `booked_date`. An `event_vendors` row carries
 * no date at all, so arms 2 and 3 take the date from `events.event_date` — and
 * that column holds a value even when `event_date_precision` is 'year', where
 * it is a placeholder the couple has not settled. Production holds such a row
 * today (4 events at 'day', 1 at 'year'). Without the precision filter a
 * supplier would be handed a full day-of console on a date nobody has agreed
 * to. `vendor_agree_to_lock` already gates its own same-date rules on
 * `precision = 'day'`; this matches it rather than inventing a rule.
 * ⚠ The date is compared as a STRING throughout (`YYYY-MM-DD` against
 * `phToday()`). Never build a `Date` from it: `new Date('2026-12-12')` is
 * midnight UTC, which is the 11th in Manila.
 *
 * ── WHERE THE RULE LIVES ───────────────────────────────────────────────────
 * This module is `server-only` and therefore CANNOT be imported by a test in
 * this repo: `server-only` is not an installed package — Next aliases it at
 * build time and plain node throws MODULE_NOT_FOUND. So the decision lives in
 * `vendor-room-access-rule.ts`, pure and importable, exactly as
 * `papic-uploads-open-rule.ts` was split out of its own IO wrapper. Eight other
 * lib modules already do this. What is left here is the three reads.
 *
 * ── FAILURE DIRECTION ──────────────────────────────────────────────────────
 * Arms 2 and 3 only ever ADD. A failed read therefore degrades to arm 1 —
 * exactly today's behaviour — and is LOGGED rather than swallowed, so a broken
 * widening cannot look like a shop with no bookings.
 */

/**
 * Every event this shop is booked on — the pool, plus the two booking paths
 * that never touch the pool. Ordered by date, one entry per (event, date).
 *
 * The rule itself lives in `vendor-room-access-rule.ts` and is pure; this
 * function is only the three reads that feed it.
 *
 * @param client  the caller's own Supabase client, used for arm 1 unchanged.
 * @param vendorProfileId  the shop, already proved by the caller (own profile
 *                         OR an access grant). Never resolved from the session
 *                         in here.
 */
export async function fetchVendorRoomEvents(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorRoomEvent[]> {
  const pool = await fetchVendorPoolBookings(client, vendorProfileId);
  const entries: VendorRoomEvent[] = pool.map((b) => ({
    ...b,
    via: 'schedule_pool' as const,
    eventVendorId: null,
  }));

  const admin = createAdminClient();

  // Candidate bookings: rows that name this shop and carry a real booked
  // status. `lock_request_state` decides arm 2; the token read below decides
  // arm 3. Both are asked of the SAME row set so a booking can only qualify
  // when the event_vendors row itself names this shop.
  const { data: rows, error: bookingError } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, lock_request_state')
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_VENDOR_STATUSES as unknown as string[])
    .is('archived_at', null);

  if (bookingError) {
    logQueryError('fetchVendorRoomEvents.event_vendors', bookingError, {
      vendor_profile_id: vendorProfileId,
    });
    return dedupe(entries);
  }

  const candidates = (rows ?? []) as BookingRow[];
  if (candidates.length === 0) return dedupe(entries);

  // Arm 3's proof: tokens THIS shop issued that a couple actually claimed.
  const { data: tokenRows, error: tokenError } = await admin
    .from('vendor_locked_qr_tokens')
    .select('claimed_event_vendor_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'claimed')
    .not('claimed_event_vendor_id', 'is', null);

  if (tokenError) {
    // Arm 2 can still stand on its own; only arm 3 is lost. Logged, not silent.
    logQueryError('fetchVendorRoomEvents.locked_qr_tokens', tokenError, {
      vendor_profile_id: vendorProfileId,
    });
  }

  const claimed = new Set(
    ((tokenRows ?? []) as { claimed_event_vendor_id: string | null }[])
      .map((t) => t.claimed_event_vendor_id)
      .filter((v): v is string => Boolean(v)),
  );

  // ⚠ NO PRE-FILTER HERE, ON PURPOSE. An "only fetch events for rows an arm
  // admits" optimisation would be a SECOND copy of the admission rule, and the
  // copy that gets forgotten is the one that silently drops a real booking.
  // `candidates` is already narrow — one shop's booked, unarchived rows — so the
  // rule lives in exactly one place: admitRoomBookings.
  const eventIds = [...new Set(candidates.map((r) => r.event_id))];
  const [{ data: events, error: eventError }, { data: threads }] = await Promise.all([
    admin
      .from('events')
      .select('event_id, display_name, event_date, event_date_precision')
      .in('event_id', eventIds),
    admin
      .from('chat_threads')
      .select('thread_id, event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', eventIds),
  ]);

  if (eventError) {
    logQueryError('fetchVendorRoomEvents.events', eventError, {
      vendor_profile_id: vendorProfileId,
    });
    return dedupe(entries);
  }

  const eventById = new Map<string, RoomEventRow>(
    ((events ?? []) as ({ event_id: string } & RoomEventRow)[]).map((e) => [
      e.event_id,
      {
        display_name: e.display_name,
        event_date: e.event_date,
        event_date_precision: e.event_date_precision,
      },
    ]),
  );
  const threadByEvent = new Map<string, string>(
    ((threads ?? []) as { thread_id: string; event_id: string }[]).map((t) => [
      t.event_id,
      t.thread_id,
    ]),
  );

  entries.push(...admitRoomBookings(candidates, claimed, eventById, threadByEvent));

  return dedupe(entries);
}

