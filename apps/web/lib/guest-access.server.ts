import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestAccessState, type GuestAccessState, type SeatRow } from '@/lib/guest-access';

/**
 * Every guest's Access on one event, keyed by guest_id — ONE read for the whole
 * list (the "+Co-host" tags) and the same answer the card shows.
 *
 * Admin client, scoped by event: event_moderators' RLS is restrictive (the
 * reason every host door reads it this way). The caller has already passed the
 * event's own gate to be rendering its guest list.
 *
 * ⚠ A refused read returns NULL, never an empty map. An empty map would render
 * every co-host as "no access" — the renders-like-emptiness failure this repo
 * keeps paying for — so callers show nothing rather than something false.
 */
export async function loadGuestAccessMap(
  eventId: string,
  guests: ReadonlyArray<{ guest_id: string; role: string }>,
): Promise<Map<string, GuestAccessState> | null> {
  const admin = createAdminClient();
  const [seatsRes, creatorsRes] = await Promise.all([
    admin
      .from('event_moderators')
      .select('guest_id, role_subtype, user_id, removed_at, created_at')
      .eq('event_id', eventId)
      .not('guest_id', 'is', null)
      .order('created_at', { ascending: true }),
    admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .eq('joined_via', 'created_event'),
  ]);
  if (seatsRes.error || creatorsRes.error) {
    logQueryError(
      'loadGuestAccessMap',
      seatsRes.error ?? creatorsRes.error,
      { eventId },
      'graceful_degrade',
    );
    return null;
  }

  // The newest seat per guest wins (ascending order, later rows overwrite).
  const seatByGuest = new Map<string, SeatRow>();
  for (const s of seatsRes.data ?? []) {
    const row = s as SeatRow & { guest_id: string };
    seatByGuest.set(row.guest_id, row);
  }

  // Which guest rows are the creator's own: their row carries the person record
  // the creator's account claimed (the creator has no member link to a row).
  const creatorIds = [...new Set((creatorsRes.data ?? []).map((c) => (c as { user_id: string }).user_id))];
  const creatorGuests = new Set<string>();
  if (creatorIds.length > 0) {
    const { data: people, error: peopleError } = await admin
      .from('people')
      .select('person_id')
      .in('claimed_by_user_id', creatorIds);
    const personIds = (people ?? []).map((p) => (p as { person_id: string }).person_id);
    const { data: rows, error: rowsError } = personIds.length
      ? await admin
          .from('guests')
          .select('guest_id')
          .eq('event_id', eventId)
          .in('person_id', personIds)
      : { data: [], error: null };
    if (peopleError || rowsError) {
      logQueryError('loadGuestAccessMap.creator', peopleError ?? rowsError, { eventId }, 'graceful_degrade');
      return null;
    }
    for (const r of rows ?? []) creatorGuests.add((r as { guest_id: string }).guest_id);
  }

  const out = new Map<string, GuestAccessState>();
  for (const g of guests) {
    out.set(
      g.guest_id,
      guestAccessState({
        seat: seatByGuest.get(g.guest_id) ?? null,
        guestRole: g.role,
        isCreator: creatorGuests.has(g.guest_id),
      }),
    );
  }
  return out;
}
