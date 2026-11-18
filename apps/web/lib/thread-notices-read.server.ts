import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { readCoupleChatHref } from '@/lib/couple-chat-door.server';
import { threadNoticeDoors, CHAT_NOTICE_TYPES } from '@/lib/thread-notice-doors';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🔔 READING A CONVERSATION CLEARS ITS CHAT NOTICES (CHAT-06, W1 walk 16 Nov 2026).
 *
 * Measured live: the couple opened the Liwanag thread and all three "New message from Liwanag" notices stayed unread
 * (bell 36); tapping one cleared only that one. The read marker (`chat_thread_reads`) moved, the bell did not — two
 * records of "has this person seen it" that disagreed. Called from `markThreadRead`, which every way into a thread
 * already runs (the couple and supplier thread pages, the picked client's Chat, the stream when it is shown).
 *
 * A notice row carries no thread id — only its link and event. So the match is this user's unread CHAT notices on
 * this event whose link is one of THIS conversation's doors (`threadNoticeDoors`: the new picked-page doors and the old
 * thread pages, so rows sent before CHAT-07 clear too). Another shop's thread on the same event is never touched.
 * Run in `after()` (it adds nothing to the thread's wait), so cookies are out of reach: the service-role client is
 * scoped to the reader's own `userId` (the pattern `markReplyNoticesSeen` uses) — it only ever marks THEIR OWN rows
 * read, which the tray's "mark read" already lets them do. Best-effort: a refused read or write leaves the bell as it
 * was and never touches the thread.
 */
export async function markThreadNoticesRead(userId: string, threadId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('event_id, vendor_profile_id')
    .eq('thread_id', threadId)
    .maybeSingle();
  const t = thread as { event_id: string | null; vendor_profile_id: string | null } | null;
  if (tErr || !t?.event_id) {
    if (tErr) logQueryError('markThreadNoticesRead.thread', tErr, { thread_id: threadId }, 'graceful_degrade');
    return;
  }
  const coupleDoor = await readCoupleChatHref(supabase, { eventId: t.event_id, vendorProfileId: t.vendor_profile_id, threadId });
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .in('type', [...CHAT_NOTICE_TYPES])
    .in('related_url', threadNoticeDoors({ eventId: t.event_id, threadId, coupleDoor }));
  if (error) logQueryError('markThreadNoticesRead.update', error, { thread_id: threadId }, 'graceful_degrade');
}
