'use client';

// Live unread-notification badge for the top-nav bell on the couple side.
//
// The badge starts from a server-rendered count (so the first paint is
// accurate without a client roundtrip) and then subscribes to the
// `notifications` table via Supabase Realtime so it stays in sync with
// inserts (new notification arrived) and updates (recipient flipped
// read_at) without a page reload.
//
// On every (re)SUBSCRIBED — including after a network drop — we refetch
// the unread count so we backfill any events missed while offline.

import { useEffect, useId, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { countUnread } from '@/lib/notifications';

type Props = {
  userId: string;
  initialUnread: number;
  href: string;
  ariaBaseLabel: string;
  ariaUnreadSuffix: string;
};

export function UnreadBellBadge({
  userId,
  initialUnread,
  href,
  ariaBaseLabel,
  ariaUnreadSuffix,
}: Props) {
  const [unread, setUnread] = useState(initialUnread);
  // 2026-05-23 — Owner reported error-boundary flash post-login: "cannot
  // add `postgres_changes` callbacks for realtime:notif-unread-{userId}
  // after `subscribe()`". Root cause: this component mounts in BOTH
  // /dashboard/layout.tsx (OuterDashboardHeader) AND
  // /dashboard/[eventId]/layout.tsx — same userId in both → Supabase
  // Realtime returns the SAME channel singleton on the 2nd mount →
  // calling .on() on an already-subscribed channel throws. useId() gives
  // each component instance a unique stable suffix, so the two mounts
  // get separate channel names ("notif-unread-{userId}-:r0:" + "-:r1:")
  // and Supabase creates two independent channels. Cleanup still calls
  // removeChannel per instance so no leak.
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      try {
        const fresh = await countUnread(supabase, userId);
        if (cancelled) return;
        setUnread(fresh);
      } catch {
        // Transient — Realtime will resync on the next event.
      }
    };

    const channel = supabase
      .channel(`notif-unread-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // New notification — bump the count optimistically. The next
          // refetch (on resubscribe) reconciles any drift.
          setUnread((n) => n + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // read_at flipped — easiest to just refetch the accurate count.
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

  const label = unread > 0 ? `${ariaBaseLabel} · ${unread} ${ariaUnreadSuffix}` : ariaBaseLabel;

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
    >
      <Bell className="h-4 w-4" strokeWidth={1.75} />
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
