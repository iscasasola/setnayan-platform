/**
 * couple-inbox.ts — ONE unread rule for the couple's Chats, read by BOTH the
 * chat icon's badge on the Suppliers header and the inbox list it opens
 * (P3, 2026-10-01 — prototype `supplier_inbox_and_find` frames 1–2).
 *
 * ── WHY A NEW READER, AND WHICH RULE IT COPIES ──────────────────────────────
 * Three unread rules already exist and they disagree:
 *   · notifications per thread (the bench's card badges, `lib/bench-unread.ts`);
 *   · the thread page's left column, which compares `chat_thread_reads` to the
 *     LAST message — so the couple's OWN last message counts as unread;
 *   · the SQL RPCs `count_unread_message_threads()` /
 *     `unread_message_threads_by_event()` — "a message from someone ELSE newer
 *     than my last_read_at, or never read".
 * The badge and the list must agree to the number (the owner taps a "3" and
 * must see three dots), so both read THIS module, and it mirrors the SQL rule —
 * the one the dashboard's own Decisions count already uses. A grouped RPC
 * cannot be reused directly: it answers per EVENT, and the list needs per THREAD.
 *
 * ── A REFUSED READ IS NOT "ALL CAUGHT UP" ────────────────────────────────────
 * `measured: false` when either read fails; the badge then hides
 * (`unreadBadgeLabel(null)`) and the list draws no dots and says nothing about
 * unread — never a confident "0".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

export type CoupleUnread = {
  /** Threads with a message from someone else newer than my last read. */
  threadIds: ReadonlySet<string>;
  measured: boolean;
};

export const COUPLE_UNREAD_UNKNOWN: CoupleUnread = { threadIds: new Set(), measured: false };

type InboxThread = {
  inquiry_status?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
};

/**
 * The threads the inbox lists as ACTIVE — and therefore the ones the header
 * badge counts. Archived (by the viewer), displaced (they booked another in a
 * one-pick category) and removed threads fold into "Archived" instead.
 */
export function isActiveInboxThread(t: InboxThread): boolean {
  return !t.archived && t.inquiry_status !== 'displaced' && t.archived_at == null;
}

/**
 * PURE. The SQL rule, over rows already read. `messages` are the OTHER side's
 * messages (any order); a thread with no read marker counts every one of them.
 */
export function unreadThreadsFrom(args: {
  messages: ReadonlyArray<{ thread_id: string; created_at: string }>;
  reads: ReadonlyArray<{ thread_id: string; last_read_at: string | null }>;
}): Set<string> {
  const lastRead = new Map<string, number>();
  for (const r of args.reads) {
    if (r.last_read_at) lastRead.set(r.thread_id, new Date(r.last_read_at).getTime());
  }
  const out = new Set<string>();
  for (const m of args.messages) {
    if (out.has(m.thread_id)) continue;
    const seen = lastRead.get(m.thread_id) ?? 0; // never read ⇒ epoch
    if (new Date(m.created_at).getTime() > seen) out.add(m.thread_id);
  }
  return out;
}

/** PURE. The number on the badge AND the "N unread" line — one count. */
export function coupleUnreadCount(
  unread: CoupleUnread,
  threads: ReadonlyArray<InboxThread & { thread_id: string }>,
): number | null {
  if (!unread.measured) return null;
  return threads.filter((t) => isActiveInboxThread(t) && unread.threadIds.has(t.thread_id)).length;
}

/**
 * Read the unread set for these threads, as the viewer. Two queries for any
 * number of threads; never throws.
 */
export async function readCoupleUnread(
  supabase: SupabaseClient,
  userId: string,
  threadIds: readonly string[],
): Promise<CoupleUnread> {
  if (threadIds.length === 0) return { threadIds: new Set(), measured: true };
  try {
    const [msgRes, readRes] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('thread_id, created_at')
        .in('thread_id', threadIds as string[])
        // `IS DISTINCT FROM auth.uid()`: a NULL sender (a bot, a system note)
        // is someone else too — `neq` alone would drop it.
        .or(`sender_user_id.is.null,sender_user_id.neq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(600),
      supabase
        .from('chat_thread_reads')
        .select('thread_id, last_read_at')
        .eq('user_id', userId)
        .in('thread_id', threadIds as string[]),
    ]);
    if (msgRes.error || readRes.error) {
      logQueryError(
        'readCoupleUnread',
        msgRes.error ?? readRes.error,
        { thread_count: threadIds.length },
        'graceful_degrade',
      );
      return COUPLE_UNREAD_UNKNOWN;
    }
    return {
      threadIds: unreadThreadsFrom({
        messages: (msgRes.data ?? []) as Array<{ thread_id: string; created_at: string }>,
        reads: (readRes.data ?? []) as Array<{ thread_id: string; last_read_at: string | null }>,
      }),
      measured: true,
    };
  } catch (caught) {
    logQueryError('readCoupleUnread (threw)', caught, { thread_count: threadIds.length }, 'graceful_degrade');
    return COUPLE_UNREAD_UNKNOWN;
  }
}
