import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveSongDeskAccess } from '@/lib/song-desk-gate';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { BOOKED_VENDOR_STATUSES } from '@/lib/vendors';
import type { SongRequestDoor } from '@/lib/guest-song-request-rule';

/**
 * CAN ANYBODY READ A SONG REQUEST ON THIS EVENT? — the guest side of SUP-52.
 *
 * The band's inbox is paid (owner 2026-07-30: "seeing the requests" is the
 * sale), and `song_requests_open_for_event` answers OPEN for every event with
 * no pause row — so on its own it would put a "Request a song" button on a
 * wedding with no band, and every request made there would reach nobody. This
 * asks the question the button actually depends on: is there a booked act on
 * this event who would get PAST the song-desk gate if they opened their inbox?
 *
 * ── IT ASKS THE BAND'S OWN GATE, NOT A COPY OF IT ──────────────────────────
 * For every shop with a booking on this event it runs the same two steps
 * `requireSongDeskAct` (vendor-dashboard/on-the-day/actions.ts) runs for the
 * band itself: `fetchVendorRoomEvents` — the ONE admission rule for "is this
 * shop booked here" — then `resolveSongDeskAccess`. A second definition of
 * "booked" or "paid" here would be a guest button that drifts from the inbox it
 * points at, which is exactly the disagreement this file exists to prevent.
 *
 * ⚠ THE EVENT TILES ARE PASSED IN, like the interconnection probe does
 * (lib/interconnect/probes.ts, `songDeskNarrowingLockout`). Left to fetch them
 * itself, `resolveSongDeskAccess` asks `get_vendor_event_brief`, which refuses
 * the service role (`42501 not_a_vendor`); the helper reads only `data`, the
 * refusal becomes null, and null means "decline to narrow" — a silently wider
 * answer than the band gets. The tiles come from the same `event_vendors`
 * statuses the brief reads.
 *
 * Fails CLOSED: any read error → null → no button. Hiding a door is honest;
 * a door that swallows requests is not.
 */

/** Shops beyond this are not checked — a wedding does not book 12 bands. */
const MAX_CANDIDATE_SHOPS = 12;

export async function eventSongRequestDoor(
  admin: SupabaseClient,
  eventId: string,
): Promise<SongRequestDoor> {
  const [pool, links] = await Promise.all([
    admin
      .from('vendor_schedule_pool_bookings')
      .select('vendor_profile_id')
      .eq('event_id', eventId)
      .is('released_at', null),
    admin
      .from('event_vendors')
      .select('marketplace_vendor_id, category')
      .eq('event_id', eventId)
      .not('marketplace_vendor_id', 'is', null)
      .in('status', BOOKED_VENDOR_STATUSES as unknown as string[])
      .is('archived_at', null),
  ]);
  if (pool.error || links.error) {
    logQueryError('eventSongRequestDoor.candidates', pool.error ?? links.error, {
      event_id: eventId,
    });
    return null;
  }

  const categoriesByShop = new Map<string, string[]>();
  for (const row of (links.data ?? []) as { marketplace_vendor_id: string; category: string | null }[]) {
    const list = categoriesByShop.get(row.marketplace_vendor_id) ?? [];
    if (row.category) list.push(row.category);
    categoriesByShop.set(row.marketplace_vendor_id, list);
  }
  const candidates = [
    ...new Set([
      ...((pool.data ?? []) as { vendor_profile_id: string }[]).map((r) => r.vendor_profile_id),
      ...categoriesByShop.keys(),
    ]),
  ].slice(0, MAX_CANDIDATE_SHOPS);
  if (candidates.length === 0) return null;

  const { data: profiles, error: profileError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, services')
    .in('vendor_profile_id', candidates);
  if (profileError) {
    logQueryError('eventSongRequestDoor.profiles', profileError, { event_id: eventId });
    return null;
  }

  let anActCanRead = false;
  for (const p of (profiles ?? []) as { vendor_profile_id: string; services: string[] | null }[]) {
    const booked = await fetchVendorRoomEvents(admin, p.vendor_profile_id);
    const cats = categoriesByShop.get(p.vendor_profile_id) ?? [];
    const access = await resolveSongDeskAccess(
      admin,
      p.vendor_profile_id,
      Array.isArray(p.services) ? p.services : [],
      eventId,
      booked.map((b) => b.eventId),
      tilesForVendorCategories(cats.length > 0 ? cats : null),
    );
    if (access.ok) {
      anActCanRead = true;
      break;
    }
  }
  if (!anActCanRead) return null;

  // The SAME predicate the submit RPC raises `songreq:closed` on, so the card
  // and the answer to pressing it cannot disagree about a pause.
  const { data: open, error: openError } = await admin.rpc('song_requests_open_for_event', {
    p_event_id: eventId,
  });
  if (openError) {
    logQueryError('eventSongRequestDoor.open', openError, { event_id: eventId });
    return null;
  }
  return open === true ? 'open' : 'paused';
}
