import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isUuid } from '@/lib/is-uuid';
import { pickHostFirstName } from '@/lib/hub-draft-authors';

/**
 * lib/host-first-name.server.ts — THE NAME THE TWO-SCREENS NOTE SAYS (owner 2026-10-18, ruling A: "Claire changed this
 * a moment ago — showing the newest.").
 *
 * Which guest row is theirs follows `formal-name-from-guest-list.ts` exactly: the person node their account claimed
 * (`guests.person_id`), or the seat saved to their account on THIS event (`event_members.guest_id`) — never a name
 * match. Then their profile (`users.first_name`, `users.display_name`). Admin read, because a co-host's account row is
 * not readable under RLS; it is called only after the host gate, for an account whose step is in THIS event's draft,
 * and only a first name leaves it. Any failure is "not known" (null → "Someone") — the save itself already landed.
 */
export async function hostFirstName(eventId: string, userId: string): Promise<string | null> {
  if (!isUuid(userId) || !isUuid(eventId)) return null;
  try {
    const admin = createAdminClient();
    const [person, seat, user] = await Promise.all([
      admin.from('people').select('person_id').eq('claimed_by_user_id', userId).is('deleted_at', null).limit(1).maybeSingle(),
      admin.from('event_members').select('guest_id').eq('event_id', eventId).eq('user_id', userId).not('guest_id', 'is', null).limit(1).maybeSingle(),
      admin.from('users').select('first_name, display_name').eq('user_id', userId).maybeSingle(),
    ]);
    if (person.error) logQueryError('hostFirstName.person', person.error, { eventId }, 'graceful_degrade');
    if (seat.error) logQueryError('hostFirstName.seat', seat.error, { eventId }, 'graceful_degrade');
    if (user.error) logQueryError('hostFirstName.user', user.error, { eventId }, 'graceful_degrade');
    const personId = (person.data as { person_id?: string } | null)?.person_id;
    const seatId = (seat.data as { guest_id?: string } | null)?.guest_id;
    const who = [personId && isUuid(personId) ? `person_id.eq.${personId}` : null, seatId && isUuid(seatId) ? `guest_id.eq.${seatId}` : null]
      .filter(Boolean)
      .join(',');
    type NameRow = { first_name: string | null; display_name: string | null };
    let guest: NameRow | null = null;
    if (who) {
      const g = await admin.from('guests').select('first_name, display_name').eq('event_id', eventId).or(who).is('deleted_at', null).limit(1).maybeSingle();
      if (g.error) logQueryError('hostFirstName.guest', g.error, { eventId }, 'graceful_degrade');
      guest = (g.data as NameRow | null) ?? null;
    }
    const u = (user.data as { first_name: string | null; display_name: string | null } | null) ?? null;
    return pickHostFirstName({ guestFirst: guest?.first_name, guestDisplay: guest?.display_name, userFirst: u?.first_name, userDisplay: u?.display_name });
  } catch (e) {
    console.error('[host-first-name] could not read the name:', e instanceof Error ? e.message : e);
    return null;
  }
}
