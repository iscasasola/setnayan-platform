'use client';

// Live unread-message badge for the Messages icon (MessageSquare) in the
// couple top bar. Shipped icon-only in PR #837; this adds the count.
//
// Mirrors UnreadBellBadge: starts from a server-rendered count (accurate
// first paint, no client roundtrip), then subscribes to the `chat_messages`
// table via Supabase Realtime so a newly-arrived message bumps the count
// without a reload. On every (re)SUBSCRIBED — including after a network drop —
// we refetch the authoritative count so we backfill anything missed offline.
//
// The count source is the SQL function count_unread_message_threads() via
// countUnreadMessages(), which graceful-degrades to 0 when the read-marker
// migration (20260728000000_chat_thread_reads.sql) isn't pushed yet — so the
// badge is safe to ship before the owner applies the migration (reads 0).

import { useEffect, useId, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { countUnreadMessages } from '@/lib/chat';
import { trackFailure } from '@/lib/telemetry/track-error';

type Props = {
  userId: string;
  initialUnread: number;
  href: string;
};

export function UnreadMessagesBadge({ userId, initialUnread, href }: Props) {
  const [unread, setUnread] = useState(initialUnread);
  // Unique per-instance channel suffix — same rationale as UnreadBellBadge:
  // if this component ever mounts twice for the same user, Supabase Realtime
  // hands back the same channel singleton and calling .on() after subscribe()
  // throws. useId() gives each mount a distinct stable channel name.
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      try {
        const fresh = await countUnreadMessages(supabase, userId);
        if (cancelled) return;
        setUnread(fresh);
      } catch (err) {
        // Transient — Realtime will resync on the next event / resubscribe.
        // Still report so a sustained count-query failure is visible.
        void trackFailure({
          eventType: 'OTHER',
          elementName: 'Unread messages badge',
          filePath: 'app/_components/unread-messages-badge.tsx',
          error: err,
          payload: { query: 'countUnreadMessages' },
        });
      }
    };

    const channel = supabase
      .channel(`msg-unread-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          // A message landed somewhere. We can't cheaply tell from the raw
          // INSERT whether it's in one of *this* user's threads or whether
          // it's their own message, so just refetch the accurate count (the
          // RPC scopes to the user + excludes their own messages server-side).
          void refresh();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refresh();
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  const label = unread > 0 ? `Messages · ${unread} unread messages` : 'Messages';

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
    >
      <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-terracotta px-1 font-mono text-[9px] font-semibold text-cream"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
