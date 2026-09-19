/**
 * vendor-room-reads.ts — the two ADMIN-scoped reads behind arms 2 and 3 of
 * `fetchVendorRoomEvents` (`lib/vendor-room-access.ts`), split out because that
 * module is `server-only` and a test cannot import it.
 *
 * ⚠ PAGED TO THE SERVER'S EXACT COUNT (`readAllPages`). Both were one un-ranged
 * SELECT. PostgREST caps a response at 1000 rows with `error: null`, so a shop
 * past a thousand booked rows (or claimed Locked QRs) silently lost the rest:
 * a real booking read as "not booked" on Bookings' tag, on Clients' Booked list
 * and on the day-of console. Each read now says whether it reached the end.
 *
 * The client passed in is the ADMIN client, scoped here by the shop id the
 * caller proved — see the docblock in `vendor-room-access.ts` for why
 * `event_vendors` cannot be read through the supplier's own session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';
import { BOOKED_VENDOR_STATUSES } from '@/lib/vendors';
import type { BookingRow, RoomEventRow } from '@/lib/vendor-room-access-rule';

/** One shop's booked, unarchived `event_vendors` rows — the room candidates. */
export async function readRoomBookingCandidates(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ rows: BookingRow[]; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id, lock_request_state', { count: 'exact' })
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', BOOKED_VENDOR_STATUSES as unknown as string[])
        .is('archived_at', null)
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  return { rows: read.rows as BookingRow[], error: read.error, complete: read.complete };
}

/** The `event_vendors` ids of every Locked QR this shop issued that a couple claimed. */
export async function readClaimedQrEventVendorIds(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ ids: Set<string>; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('vendor_locked_qr_tokens')
        .select('claimed_event_vendor_id', { count: 'exact' })
        .eq('vendor_profile_id', vendorProfileId)
        .eq('status', 'claimed')
        .not('claimed_event_vendor_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  const ids = new Set(
    (read.rows as { claimed_event_vendor_id: string | null }[])
      .map((t) => t.claimed_event_vendor_id)
      .filter((v): v is string => Boolean(v)),
  );
  return { ids, error: read.error, complete: read.complete };
}

/**
 * The date and thread for each candidate's event. Chunked (`IN_LIST_CHUNK`):
 * past ~600 ids one `in.()` is refused 400 by the gateway, which dropped arms 2
 * and 3 for exactly the busiest shops.
 */
export async function readRoomEventFacts(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventIds: readonly string[],
): Promise<{
  events: ({ event_id: string } & RoomEventRow)[];
  eventError: { message: string } | null;
  threads: { thread_id: string; event_id: string }[];
}> {
  const [{ rows: events, error: eventError }, { rows: threads }] = await Promise.all([
    readInChunks<{ event_id: string } & RoomEventRow>(eventIds, (part) =>
      admin
        .from('events')
        .select('event_id, display_name, event_date, event_date_precision')
        .in('event_id', part),
    ),
    readInChunks<{ thread_id: string; event_id: string }>(eventIds, (part) =>
      admin
        .from('chat_threads')
        .select('thread_id, event_id')
        .eq('vendor_profile_id', vendorProfileId)
        .in('event_id', part),
    ),
  ]);
  return { events, eventError, threads };
}
