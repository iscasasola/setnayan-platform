import type { SupabaseClient } from '@supabase/supabase-js';
import { readInChunks } from '@/lib/read-all-pages';

/**
 * 🔢 PIECES NEVER TAKE A SEAT (owner 2026-11-19, AVAILABILITY FINALIZED 2c — "pieces take only pieces"; review of #8012).
 *
 * A by-the-piece booking still writes its seat row on its schedule (so the day lists who has the chairs), but it is
 * never COUNTED as a seat: 200 chairs on a schedule shared with a photo booth leave the booth's seats alone. The
 * database's own count (`schedule_pool_taken_on`) already skips piece cards; this is the SAME rule for every reader
 * that counts seat rows in the app (the Clients calendar, Check a date, the chat's day answer), so no screen calls a
 * seat taken that the guard calls free.
 *
 * Returns the booking rows (`event_vendors.vendor_id`) whose card rents by the piece. `null` = a read was refused —
 * the caller then counts every row as a seat (the old count, the fuller side), and logs.
 */
export async function pieceBookingIdsOf(
  client: SupabaseClient,
  eventVendorIds: readonly (string | null | undefined)[],
): Promise<{ ids: Set<string>; error: null } | { ids: null; error: { message: string } }> {
  const ids = [...new Set(eventVendorIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (ids.length === 0) return { ids: new Set(), error: null };
  const rows = await readInChunks<{ vendor_id: string; service_id: string | null }>(ids, (part) =>
    client.from('event_vendors').select('vendor_id, service_id').in('vendor_id', part),
  );
  if (rows.error) return { ids: null, error: rows.error };
  const serviceIds = [...new Set(rows.rows.map((r) => r.service_id).filter((s): s is string => Boolean(s)))];
  if (serviceIds.length === 0) return { ids: new Set(), error: null };
  const cards = await readInChunks<{ vendor_service_id: string; availability_style: string | null }>(serviceIds, (part) =>
    client.from('vendor_services').select('vendor_service_id, availability_style').in('vendor_service_id', part),
  );
  if (cards.error) return { ids: null, error: cards.error };
  const pieceCards = new Set(cards.rows.filter((c) => c.availability_style === 'piece').map((c) => c.vendor_service_id));
  return { ids: new Set(rows.rows.filter((r) => r.service_id && pieceCards.has(r.service_id)).map((r) => r.vendor_id)), error: null };
}
