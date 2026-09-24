/**
 * vendor-unread-threads.ts — which of a user's chat threads hold unread
 * `chat_message` notifications, and HOW MANY each holds. Feeds the "Unread" dot
 * on the supplier's Bookings list and the unread badge on the couple's team
 * cards.
 *
 * ⚠ THE FILENAME SAYS "vendor" AND THE READ IS NOT VENDOR-SPECIFIC. It filters
 * on `user_id` + `type = 'chat_message'` + unread, which is true of either side
 * of a conversation. The couple's notification carries
 * `relatedUrl: /dashboard/<eventId>/messages/<threadId>` (`lib/chat-actions.ts`)
 * and the supplier's carries `/vendor-dashboard/messages/<threadId>`, so the
 * last path segment is the thread id for BOTH and the parse below is unchanged.
 * The name is kept deliberately — renaming a shipped module is how a guard gets
 * disarmed silently — and this note is the correction instead.
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

/**
 * How many unread `chat_message` notifications each of this user's threads holds.
 *
 * 🔑 ONE QUERY AND ONE PARSE FOR BOTH ANSWERS. The Set below is derived from this
 * map's keys rather than read separately: a supplier's dot and a couple's badge
 * are the same fact counted at two resolutions, and two reads of one fact drift
 * within a week while each passes its own test.
 *
 * ⚠ `complete: false` and a non-null `error` mean **we do not know**, NOT zero.
 * A caller that renders "0" from either has reintroduced the defect this file's
 * header describes — a refused read was once `?? []` and every dot vanished.
 */
export async function readUnreadChatCountsByThread(
  client: SupabaseClient,
  userId: string,
): Promise<{ countByThread: Map<string, number>; error: string | null; complete: boolean }> {
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
  const countByThread = new Map<string, number>();
  for (const n of read.rows as { related_url: string | null }[]) {
    const url = n.related_url ?? '';
    const idx = url.lastIndexOf('/');
    if (idx < 0) continue;
    const threadId = url.slice(idx + 1);
    // A notification whose url ends in a slash has no thread to attribute to.
    if (threadId === '') continue;
    countByThread.set(threadId, (countByThread.get(threadId) ?? 0) + 1);
  }
  return { countByThread, error: read.error, complete: read.complete };
}

/**
 * Which threads hold anything unread — the supplier Bookings dot's question.
 *
 * Derived from `readUnreadChatCountsByThread` so there is exactly one query and
 * one url parse in this file. Behaviour is unchanged: the same rows, the same
 * ids, the same `error` / `complete`, pinned by
 * `the-four-small-lists-read-to-the-end.test.ts`.
 */
export async function readUnreadChatThreadIds(
  client: SupabaseClient,
  userId: string,
): Promise<{ threadIds: Set<string>; error: string | null; complete: boolean }> {
  const read = await readUnreadChatCountsByThread(client, userId);
  return { threadIds: new Set(read.countByThread.keys()), error: read.error, complete: read.complete };
}
