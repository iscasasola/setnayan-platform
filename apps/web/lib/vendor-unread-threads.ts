/**
 * vendor-unread-threads.ts — which of a user's chat threads hold an unread
 * `chat_message` notification. Feeds the "Unread" dot on the supplier's
 * Bookings list.
 *
 * ⚠ PAGED TO THE SERVER'S EXACT COUNT (`readAllPages`). This was one un-ranged
 * SELECT inside `bookings/surface.tsx`. Unread notifications pile up — one per
 * message the supplier has not opened — and PostgREST caps one response at
 * 1000 rows with `error: null`, so past that the older threads' dots vanished
 * as if they had been read. A refused read was `?? []`: every dot gone. Both
 * now come back `complete: false` for the list to say so.
 *
 * The notification's `related_url` ends in the thread id
 * (`/vendor-dashboard/messages/<threadId>`), so the id is the last segment.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';

export async function readUnreadChatThreadIds(
  client: SupabaseClient,
  userId: string,
): Promise<{ threadIds: Set<string>; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await client
        .from('notifications')
        .select('related_url', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', 'chat_message')
        .is('read_at', null)
        .order('notification_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  const threadIds = new Set<string>();
  for (const n of read.rows as { related_url: string | null }[]) {
    const url = n.related_url ?? '';
    const idx = url.lastIndexOf('/');
    if (idx >= 0) threadIds.add(url.slice(idx + 1));
  }
  return { threadIds, error: read.error, complete: read.complete };
}
