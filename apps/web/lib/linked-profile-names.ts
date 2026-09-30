import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { FORMAL_NAME_FIELDS, profileFormalName, type FormalName } from '@/lib/formal-name';

/**
 * linked-profile-names.ts — a guest row linked to an account wears the name on
 * that account's profile.
 *
 * ⚖ Owner 2026-09-30, on his own groom row (DECISION_LOG "A GUEST ROW LINKED TO
 * AN ACCOUNT SHOWS THE ACCOUNT PROFILE'S DETAILS"): *"my details should be fixed
 * on my account profile as well"*. The list and the card must show the SAME
 * formal name, read-only, edited only on the person's own profile.
 *
 * ── WHEN THE PROFILE WINS ──────────────────────────────────────────────────
 * Only when the profile HAS a formal name — a first AND a last name. An account
 * that has never filled its name leaves the row as the couple typed it (and
 * editable): locking a name to an empty profile would leave nobody able to fix
 * it. The person is offered the row's name on their own profile instead
 * (`lib/formal-name-from-guest-list.ts`, one tap, never silent).
 *
 * ── THE GATE (the same shape as lib/guest-account-photos.ts) ───────────────
 *  1. The membership read runs as the CALLER — RLS decides whether they may see
 *     this event's members at all. Refused or not a member → no ids → the admin
 *     client is never asked anything.
 *  2. The admin read is keyed to exactly those ids and selects the key and the
 *     five name parts. No email, no photo, no preference.
 *  3. Nothing leaves but `guest_id → { name, userId }`.
 */

export type LinkedProfileName = { name: FormalName; userId: string };

export async function accountNamesByGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Record<string, LinkedProfileName>> {
  const { data: members, error: memberErr } = await supabase
    .from('event_members')
    .select('guest_id, user_id')
    .eq('event_id', eventId)
    .not('guest_id', 'is', null)
    .not('user_id', 'is', null);
  if (memberErr) {
    // Degrades to the row's own name — what every screen showed before this.
    logQueryError('linked-profile-names: event_members', memberErr, { eventId }, 'graceful_degrade');
    return {};
  }
  const rows = (members ?? []) as Array<{ guest_id: string; user_id: string }>;
  if (rows.length === 0) return {};

  const { data: users, error: userErr } = await createAdminClient()
    .from('users')
    .select(`user_id, ${FORMAL_NAME_FIELDS.join(', ')}`)
    .in('user_id', [...new Set(rows.map((r) => r.user_id))])
    .not('first_name', 'is', null)
    .not('last_name', 'is', null);
  if (userErr) {
    logQueryError('linked-profile-names: users', userErr, { eventId }, 'graceful_degrade');
    return {};
  }

  const byUser = new Map<string, FormalName>();
  for (const u of (users ?? []) as unknown as Array<FormalName & { user_id: string }>) {
    const name = profileFormalName(u);
    if (name) byUser.set(u.user_id, name);
  }
  const out: Record<string, LinkedProfileName> = {};
  for (const row of rows) {
    const name = byUser.get(row.user_id);
    if (name && !out[row.guest_id]) out[row.guest_id] = { name, userId: row.user_id };
  }
  return out;
}
