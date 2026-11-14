import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🔔 A CONNECTION PUT ON A GUEST LIST IS TOLD (W1/W3 RW-197, 2026-11-14: "a guest invited to an event gets NO notice").
 *
 * Adding one of "Your people" from People puts them on the list BY NAME ONLY — on purpose: the picker never carries a
 * connection's email or person id to the browser (`lib/people-you-can-invite.ts`, "emails never leave the server").
 * So the guest row had nothing tying it to the account, and the account was never told: no request on its Events page,
 * no row in its bell. Measured on prod: every guest who belonged to an account was linked only later, when they found
 * the invitation link themselves.
 *
 * This links the NEW guest row to the connected person — server-side, after the insert, from the CONFIRMED connection
 * the host's own person holds. Nothing crosses to the client. The guest row's `person_id` then names the account, and
 * the database does the rest (migration 20271346481550): `an_invitation_reaches_the_account` drops ONE
 * `event_invitation` notice and `incoming_requests_for_me` shows the Yes / No — both only for an account whose email is
 * confirmed. `set_guest_person` runs on INSERT and on an email change only, so this update sticks.
 *
 * 🔒 THE CONNECTION IS RE-READ HERE, NOT TRUSTED FROM THE PICK: it must be confirmed, the host's own person must be one
 * end, and the other end must be claimed by an account. Fail-soft: a link that cannot be made leaves the guest added by
 * name, exactly as before — the add is the product.
 */
export async function linkConnectedGuests(
  admin: SupabaseClient,
  hostUserId: string,
  eventId: string,
  added: ReadonlyArray<{ guestId: string; connectionId: string }>,
): Promise<number> {
  if (added.length === 0) return 0;
  try {
    const { data: mine, error: meError } = await admin
      .from('people')
      .select('person_id')
      .eq('claimed_by_user_id', hostUserId)
      .is('deleted_at', null)
      .maybeSingle();
    if (meError) {
      logQueryError('linkConnectedGuests people(me)', meError, { eventId }, 'graceful_degrade');
      return 0;
    }
    const myPerson = (mine as { person_id: string } | null)?.person_id;
    if (!myPerson) return 0;

    const { data: conns, error: connError } = await admin
      .from('person_connections')
      .select('connection_id, from_person_id, to_person_id')
      .in('connection_id', added.map((a) => a.connectionId))
      .eq('status', 'confirmed')
      .is('deleted_at', null);
    if (connError) {
      logQueryError('linkConnectedGuests person_connections', connError, { eventId }, 'graceful_degrade');
      return 0;
    }
    const otherOf = new Map<string, string>();
    for (const c of (conns ?? []) as Array<{ connection_id: string; from_person_id: string; to_person_id: string }>) {
      if (c.from_person_id === myPerson) otherOf.set(c.connection_id, c.to_person_id);
      else if (c.to_person_id === myPerson) otherOf.set(c.connection_id, c.from_person_id);
    }
    const others = [...new Set(otherOf.values())];
    if (others.length === 0) return 0;

    const { data: claimed, error: claimError } = await admin
      .from('people')
      .select('person_id')
      .in('person_id', others)
      .not('claimed_by_user_id', 'is', null)
      .is('deleted_at', null);
    if (claimError) {
      logQueryError('linkConnectedGuests people(claimed)', claimError, { eventId }, 'graceful_degrade');
      return 0;
    }
    const hasAccount = new Set(((claimed ?? []) as Array<{ person_id: string }>).map((p) => p.person_id));

    let linked = 0;
    for (const a of added) {
      const person = otherOf.get(a.connectionId);
      if (!person || !hasAccount.has(person)) continue;
      const { error } = await admin
        .from('guests')
        .update({ person_id: person })
        .eq('guest_id', a.guestId)
        .eq('event_id', eventId)
        .is('deleted_at', null);
      if (error) logQueryError('linkConnectedGuests guests.update', error, { eventId }, 'graceful_degrade');
      else linked += 1;
    }
    return linked;
  } catch (caught) {
    logQueryError(
      'linkConnectedGuests (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { eventId },
      'graceful_degrade',
    );
    return 0;
  }
}
