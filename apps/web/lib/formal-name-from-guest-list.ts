import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isUuid } from '@/lib/is-uuid';
import { FORMAL_NAME_FIELDS, isFormalNameEmpty, type FormalName } from '@/lib/formal-name';

/**
 * formal-name-from-guest-list.ts — the name a host already typed for you,
 * offered back on your own profile.
 *
 * Owner, 2026-09-21, about his own account: *"make me link to my guestlist as
 * the groom … i want that when i open my profile and settings, these
 * information should be there."* His groom row already said "Mr. Indalecio
 * Sacdalan Casasola II"; his profile had only a nickname.
 *
 * ── WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────
 * It OFFERS the name — nothing is written. The profile page shows one line,
 * "Use '<name>' from <event>'s list", and only that tap fills the profile's
 * EMPTY parts (owner 2026-09-30: "one tap, never silent"), so a name somebody
 * else typed never becomes theirs without them looking at it. Only the name travels this way:
 * meal and allergies are health/preference data with their own consent rules
 * (`link-guest-account.ts`), and nothing here reads them.
 *
 * ── WHICH ROW ──────────────────────────────────────────────────────────────
 * A guest row is "yours" only through `guests.person_id` = the person node
 * YOUR account has claimed (`people.claimed_by_user_id`), or through the seat
 * you saved to your account (`event_members.guest_id`). Both links are made on
 * purpose — from an email on the row, or when you join through the invitation —
 * never by a name match. Among your rows, the one where you are
 * the couple (groom / bride / celebrant) wins, because that is the row you or
 * your partner wrote most carefully; then the most recently edited.
 *
 * 🔒 Admin read, because another event's guest rows are invisible to you under
 * RLS. It is scoped to YOUR claimed person id and YOUR saved seats, and returns five name parts and
 * an event title — nothing else leaves this function.
 */

export type FormalNameSuggestion = { name: FormalName; eventTitle: string | null };

const OWN_ROLES = new Set(['groom', 'bride', 'celebrant']);

export async function formalNameFromGuestList(
  userId: string,
): Promise<FormalNameSuggestion | null> {
  if (!userId) return null;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  // Two ways a row is yours, both made on purpose, never by a name: the person
  // node your account claimed (`guests.person_id`), and the seat you saved to
  // this account (`event_members.guest_id`, lib/link-guest-account.ts).
  const [{ data: me, error: meError }, { data: seats, error: seatsError }] = await Promise.all([
    admin
      .from('people')
      .select('person_id')
      .eq('claimed_by_user_id', userId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle(),
    admin
      .from('event_members')
      .select('guest_id')
      .eq('user_id', userId)
      .not('guest_id', 'is', null)
      .limit(20),
  ]);
  if (meError) logQueryError('formalNameFromGuestList.person', meError, {}, 'graceful_degrade');
  if (seatsError) logQueryError('formalNameFromGuestList.seats', seatsError, {}, 'graceful_degrade');
  const personId = (me as { person_id: string } | null)?.person_id;
  const seatIds = ((seats ?? []) as Array<{ guest_id: string }>).map((r) => r.guest_id).filter(isUuid);
  const who = [personId && isUuid(personId) ? `person_id.eq.${personId}` : null, seatIds.length ? `guest_id.in.(${seatIds.join(',')})` : null]
    .filter(Boolean)
    .join(',');
  if (!who) return null;

  const { data: rows, error } = await admin
    .from('guests')
    .select(`event_id, role, updated_at, ${FORMAL_NAME_FIELDS.join(', ')}`)
    .or(who)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) {
    logQueryError('formalNameFromGuestList.guests', error, {}, 'graceful_degrade');
    return null;
  }

  const usable = ((rows ?? []) as unknown as Array<FormalName & { event_id: string; role: string | null }>)
    .filter((r) => !isFormalNameEmpty(r));
  if (usable.length === 0) return null;
  const pick = usable.find((r) => OWN_ROLES.has(r.role ?? '')) ?? usable[0]!;

  const { data: ev } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', pick.event_id)
    .maybeSingle();

  const name = {} as FormalName;
  for (const f of FORMAL_NAME_FIELDS) name[f] = (pick[f] ?? '').trim() || null;
  return {
    name,
    eventTitle: ((ev as { display_name: string | null } | null)?.display_name ?? '').trim() || null,
  };
}
