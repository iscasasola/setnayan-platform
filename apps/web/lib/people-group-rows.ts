import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchUserCommunities } from '@/lib/communities';
import { manilaToday, shapeGroupRows, type GroupActivityRow, type GroupChatRow } from '@/lib/people-group-rows-shape';

/**
 * people-group-rows.ts — THE READER for the People page's group rows (owner 2026-10-28, "Group rows read like
 * chats"; shapes and the NO-UNREAD reason in `people-group-rows-shape.ts`).
 *
 * ⚡ ONE BATCHED READ FOR ALL ROWS — never one per row. After the shipped group list (`fetchUserCommunities`, cached
 * per request), ONE request to `communities` embeds, per group:
 *   · `samahan_messages` — the newest live message (ordered, limited to 1 PER GROUP by PostgREST's embedded limit);
 *   · `samahan_stories`  — the stories still inside their 24 h (RLS hides the rest; filtered here as well);
 *   · `events`           — the group's upcoming events (from Manila's today, not archived; the earliest is picked
 *                          when the row is shaped).
 * Beside it, ONE unread call (`samahan_unread_counts()`, every group at once). Then ONE names read (admin client, `user_id → display_name` only — the split `fetchSamahanMessages` uses, for the
 * same RA 10173 reason) for the authors of those last lines. Three requests whatever the number of groups.
 * 🔒 lib/people-group-rows.test.ts counts the requests on a fake fetch.
 *
 * 🔴 A REFUSED READ IS NOT A QUIET GROUP. The activity read failing returns `activityUnreadable: true`; the rows keep
 * their shipped line and the list says once that the latest messages did not load.
 */
export type PeopleGroupRows = {
  rows: GroupChatRow[];
  /** The unread counts were refused — the pinned row says "Couldn't load", never 0. */
  unreadUnreadable: boolean;
  /** The group LIST was refused (or came back empty while the roster's count says otherwise — the caller decides). */
  listEmpty: boolean;
  /** The one activity read was refused — no row may say "No messages yet". */
  activityUnreadable: boolean;
};

export const GROUP_ACTIVITY_SELECT =
  'community_id, samahan_messages(user_id, body, created_at, deleted_at), samahan_stories(story_id, expires_at), events(event_id, display_name, event_date, archived)';

/** The one request — exported so the test can run it on a fake client and count what it sends. */
export async function readGroupActivity(
  supabase: SupabaseClient,
  ids: readonly string[],
  now: Date,
): Promise<GroupActivityRow[] | null> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('communities')
    .select(GROUP_ACTIVITY_SELECT)
    .in('community_id', [...ids])
    .is('samahan_messages.deleted_at', null)
    .order('created_at', { referencedTable: 'samahan_messages', ascending: false })
    .limit(1, { referencedTable: 'samahan_messages' })
    .gt('samahan_stories.expires_at', now.toISOString())
    .limit(99, { referencedTable: 'samahan_stories' })
    .eq('events.archived', false)
    .gte('events.event_date', manilaToday(now))
    // The earliest of these is picked in `shapeGroupRows` (a group holds a handful of upcoming events), so no embedded
    // order is asked of PostgREST here.
    .limit(20, { referencedTable: 'events' });
  if (error) {
    logQueryError('readGroupActivity', error, { groups: ids.length }, 'graceful_degrade');
    return null;
  }
  return (data ?? []) as unknown as GroupActivityRow[];
}

/**
 * 🔴 Unread per group (owner 2026-10-28, "GROUP UNREAD") — ONE call, `samahan_unread_counts()` (migration samahan_reads):
 * others' live messages newer than your marker, or than when you joined. null = refused.
 */
export async function readUnreadCounts(supabase: SupabaseClient): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.rpc('samahan_unread_counts');
  if (error) {
    logQueryError('readUnreadCounts', error, {}, 'graceful_degrade');
    return null;
  }
  return new Map(((data ?? []) as Array<{ community_id: string; unread: number }>).map((r) => [r.community_id, Number(r.unread) || 0]));
}

/** Display names for the authors of the last lines — one read, names only. */
export async function readSpeakerNames(admin: SupabaseClient, userIds: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  const { data, error } = await admin.from('users').select('user_id, display_name').in('user_id', [...userIds]);
  if (error) logQueryError('readSpeakerNames', error, { users: userIds.length }, 'graceful_degrade');
  for (const r of (data ?? []) as Array<{ user_id: string; display_name: string | null }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.user_id, label);
  }
  return names;
}

export const readPeopleGroupRows = cache(
  async (supabase: SupabaseClient, admin: SupabaseClient, userId: string): Promise<PeopleGroupRows> => {
    const now = new Date();
    const groups = (await fetchUserCommunities(supabase, userId)).filter((c) => !c.archived);
    const [activity, unread] = await Promise.all([
      readGroupActivity(supabase, groups.map((g) => g.community_id), now),
      groups.length > 0 ? readUnreadCounts(supabase) : Promise.resolve(new Map<string, number>()),
    ]);
    const authors = [
      ...new Set((activity ?? []).flatMap((a) => (a.samahan_messages ?? []).slice(0, 1).map((m) => m.user_id)).filter((id) => id !== userId)),
    ];
    const names = await readSpeakerNames(admin, authors);
    return {
      rows: shapeGroupRows(groups, activity, names, userId, now, unread),
      unreadUnreadable: unread === null,
      listEmpty: groups.length === 0,
      activityUnreadable: activity === null,
    };
  },
);
