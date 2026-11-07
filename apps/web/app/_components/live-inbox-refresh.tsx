'use client';

/**
 * LiveInboxRefresh — an inbox page re-renders when a chat message arrives (owner 2026-10-29, "chat arrives
 * instantly"). Renders nothing. Mounted on the couple's Messages page and the supplier's Chats page — never on a
 * layout, never on a thread page (an open thread already streams its own messages), never under app/[slug].
 *
 * With NEXT_PUBLIC_CHAT_LIVE_ENABLED off (the default) the effect returns on its first line: nothing is fetched,
 * nothing is joined, the page is exactly as before. On, it shares the tab's ONE `user:<uid>` channel with the
 * Messages envelope (lib/user-live-channel.ts) and calls `router.refresh()` at most once per 5 s
 * (`followInboxLive`, lib/unread-follow.ts).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isChatLiveEnabled } from '@/lib/chat-live-flag';

export function LiveInboxRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!isChatLiveEnabled()) return;
    let gone = false;
    let stop: (() => void) | null = null;
    void Promise.all([import('@/lib/supabase/client'), import('@/lib/unread-follow'), import('@/lib/user-live-channel')])
      .then(([{ createClient }, { followInboxLive }, { subscribeUserLive }]) => {
        if (gone) return;
        stop = followInboxLive({
          supabase: createClient(),
          userId,
          refresh: () => router.refresh(),
          subscribe: subscribeUserLive,
        });
      })
      .catch(() => {
        /* the live half did not load: the inbox is current on navigation, as it always was */
      });
    return () => {
      gone = true;
      stop?.();
    };
  }, [router, userId]);
  return null;
}
