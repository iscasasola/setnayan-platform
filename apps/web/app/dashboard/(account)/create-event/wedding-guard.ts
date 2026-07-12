import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Wedding cardinality — the "one wedding at a time" guard (owner-locked
 * 2026-07-12, HARD BLOCK: "you cannot have 2 weddings at the same time").
 *
 * A user may co-host at most ONE non-archived wedding. Tapping "Wedding" again
 * while one is active is blocked outright — no second wedding event is created.
 * To start a new wedding (e.g. a remarriage after the first is over), the
 * existing one must be finished/archived first, which frees the slot.
 *
 * Shared by the create-event PAGE (to show the block message instead of the
 * form) and the create-event SERVER ACTION (the authoritative enforcement — the
 * UI can be bypassed, the action cannot).
 *
 * ⚠ Known edges the strict block also stops (flagged for a future exception
 * path, not handled here): the Muslim-rite concurrent unions (PD 1083, up to 4)
 * and the civil-then-church SAME marriage — the latter should be modeled as one
 * wedding with two ceremonies, never a second wedding event.
 */
export async function hasActiveWeddingForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('event_members')
    .select('events:event_id(event_type, archived)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  return (data ?? []).some((row) => {
    const e = (row as { events: { event_type: string; archived: boolean } | { event_type: string; archived: boolean }[] | null }).events;
    const ev = Array.isArray(e) ? e[0] : e;
    return ev != null && ev.event_type === 'wedding' && ev.archived === false;
  });
}
