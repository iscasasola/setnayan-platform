/**
 * The chat icon + unread count beside ⋯ on the Suppliers header (owner-approved
 * 2026-10-01, prototype `supplier_inbox_and_find` frame 1). A SERVER component:
 * it reads, the takeover only places it (`chatSlot`), and nothing here reaches
 * the shared client bundle.
 *
 * 🔑 The count is `coupleUnreadCount` over `readCoupleUnread` — the SAME reader
 * and the same active-thread predicate the Chats list it opens uses, so the "3"
 * here is the three dots there. A refused read hides the badge (never "0").
 */
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCoupleThreads } from '@/lib/chat';
import { coupleUnreadCount, readCoupleUnread } from '@/lib/couple-inbox';
import { unreadBadgeAria, unreadBadgeLabel } from '@/lib/bench-unread';
import { logQueryError } from '@/lib/supabase/error-detect';

export async function ChatsDoor({
  supabase,
  eventId,
  userId,
}: {
  supabase: SupabaseClient;
  eventId: string;
  userId: string;
}) {
  let count: number | null = null;
  try {
    const threads = await fetchCoupleThreads(supabase, eventId);
    const unread = await readCoupleUnread(
      supabase,
      userId,
      threads.map((t) => t.thread_id),
    );
    count = coupleUnreadCount(unread, threads);
  } catch (caught) {
    logQueryError('ChatsDoor.threads', caught, { event_id: eventId }, 'graceful_degrade');
    count = null; // unknown ⇒ no badge, never "0"
  }
  const label = unreadBadgeLabel(count);
  return (
    <Link
      href={`/dashboard/${eventId}/messages`}
      aria-label={unreadBadgeAria(count) ? `Chats, ${unreadBadgeAria(count)}` : 'Chats'}
      data-chats-door=""
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
    >
      <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
      {label ? (
        <span
          aria-hidden
          data-chats-unread={label}
          className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-mulberry px-1 text-center text-[10.5px] font-semibold leading-[18px] text-cream"
        >
          {label}
        </span>
      ) : null}
    </Link>
  );
}
