/**
 * The RA 10173 export's "when you last opened an Event Hub" section (Who's here, owner 2026-10-29): the subject's OWN
 * `hub_guest_views` rows — the one timestamp a host's Home card shows ("Tito Ben is viewing"), kept a day at most.
 *
 * The same shape and the same reasons as `export-own-gift-records.ts`: the table has no user column (a row is keyed
 * to a GUEST), its only SELECT policy admits the event's TEAM, so
 *   • a guest's own session reads none of their own rows — read with the service-role client, bounded below;
 *   • a host's session reads every guest's row at their event — those are the guests' data, not the host's.
 * One filter for every caller: the subject's OWN guest ids (`event_members.guest_id`, the link erasure walks too).
 *
 * No `server-only` import, so tsx can load it for a test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { distinctGuestIds } from './account-erasure';

export async function readOwnHubViews(
  client: SupabaseClient,
  admin: SupabaseClient | null,
  userId: string,
): Promise<{ data: unknown[] | null; error: { message: string } | null } | null> {
  // NOT READ is told apart from "you opened none" — the caller names the section.
  if (!admin) return null;
  const mine = await client
    .from('event_members')
    .select('guest_id')
    .eq('user_id', userId)
    .not('guest_id', 'is', null);
  if (mine.error) return { data: null, error: mine.error };
  const ownGuestIds = distinctGuestIds(mine.data as Array<{ guest_id?: string | null }>);
  if (ownGuestIds.length === 0) return { data: [], error: null };
  const res = await admin
    .from('hub_guest_views')
    .select('event_id, last_seen_at')
    .in('guest_id', ownGuestIds)
    .order('last_seen_at', { ascending: true });
  if (res.error) return { data: null, error: res.error };
  return { data: res.data ?? [], error: null };
}
