import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
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
 * It PRE-FILLS the form — nothing is written. The profile stays empty in the
 * database until the person presses Save, so a name somebody else typed never
 * becomes theirs without them looking at it. Only the name travels this way:
 * meal and allergies are health/preference data with their own consent rules
 * (`link-guest-account.ts`), and nothing here reads them.
 *
 * ── WHICH ROW ──────────────────────────────────────────────────────────────
 * A guest row is "yours" only through `guests.person_id` = the person node
 * YOUR account has claimed (`people.claimed_by_user_id`). That link is made by
 * the database — from an email on the row, or when you join through the
 * invitation — never by a name match. Among your rows, the one where you are
 * the couple (groom / bride / celebrant) wins, because that is the row you or
 * your partner wrote most carefully; then the most recently edited.
 *
 * 🔒 Admin read, because another event's guest rows are invisible to you under
 * RLS. It is scoped to YOUR claimed person id and returns five name parts and
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

  const { data: me, error: meError } = await admin
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (meError) {
    logQueryError('formalNameFromGuestList.person', meError, {}, 'graceful_degrade');
    return null;
  }
  const personId = (me as { person_id: string } | null)?.person_id;
  if (!personId) return null;

  const { data: rows, error } = await admin
    .from('guests')
    .select(`event_id, role, updated_at, ${FORMAL_NAME_FIELDS.join(', ')}`)
    .eq('person_id', personId)
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
