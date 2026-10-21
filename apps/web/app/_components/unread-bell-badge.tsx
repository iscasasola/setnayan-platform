'use client';

// Unread-notification badge for the top-nav bell (every signed-in layout).
//
// The badge starts from a server-rendered count (so the first paint is
// accurate without a client roundtrip) and then RE-ASKS the count on a slow
// timer while the tab is in view, and at once when the person comes back to
// the tab (`startCountPoll`, lib/tab-return.ts).
//
// 🔌 NO SOCKET (2026-10-21, live connections only where live). It used to
// subscribe to `notifications` over Supabase Realtime — and because the bell is
// in every signed-in layout, every plain page held a websocket open all day, in
// every tab. A badge is not a conversation: a minute's delay is invisible, and
// coming back to the tab asks at once.
//
// 🔒 A FAILED READ CHANGES NOTHING. `readUnreadNotificationCount` answers `null`
// when it could not read, and the poll never hands `null` on — so a refused or
// dropped read leaves the drawn count standing instead of a false 0.

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { readRecentUnreadOfTypes, readUnreadNotificationCount, type NotificationType } from '@/lib/notifications';
import { startCountPoll } from '@/lib/tab-return';
import { trackFailure } from '@/lib/telemetry/track-error';

/**
 * 🔑 BEING MADE A HOST CHANGES WHAT AN OPEN PAGE SHOULD SHOW (owner 2026-09-28:
 * "they do not need to resign in. it should auto refresh"). An INVITATION
 * changes the Events page too: its Incoming requests section appears without a
 * reload. When the count goes UP the bell asks whether one of these arrived,
 * and refreshes the server render if so — no reload, nothing typed is lost.
 */
const PAGE_CHANGING_TYPES: readonly NotificationType[] = ['cohost_added', 'event_invitation'];
/** How far back "arrived" looks — comfortably longer than one poll plus a hidden stretch's catch-up ask. */
const ARRIVAL_WINDOW_MS = 15 * 60_000;

type Props = {
  userId: string;
  initialUnread: number;
  href: string;
  ariaBaseLabel: string;
  ariaUnreadSuffix: string;
  /** OPT-IN live pulse + expanding gold ring on the unread badge (home-launcher
   *  pixel pass 2026-07-15; proto bell dot pulse/ringGold). Off by default so
   *  the component's other mounts are unchanged. The global reduced-motion
   *  freeze caps both animations to a single instant run. */
  pulse?: boolean;
};

export function UnreadBellBadge({
  userId,
  initialUnread,
  href,
  ariaBaseLabel,
  ariaUnreadSuffix,
  pulse = false,
}: Props) {
  const [unread, setUnread] = useState(initialUnread);
  const router = useRouter();
  const shown = useRef(initialUnread);
  shown.current = unread;

  // A fresh server render wins: "Mark all read" revalidates the layout, which
  // re-renders this with the new count — what the old realtime UPDATE handler did.
  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    const supabase = createClient();
    const seen = new Set<string>();
    let reported = false;

    const checkArrivals = async () => {
      const ids = await readRecentUnreadOfTypes(supabase, userId, PAGE_CHANGING_TYPES, ARRIVAL_WINDOW_MS);
      if (!ids) return;
      const fresh = ids.filter((id) => !seen.has(id));
      ids.forEach((id) => seen.add(id));
      if (fresh.length > 0) {
        // one-render: keep (realtime) — a poll saw a notification arrive (made a host / invited); nothing was pressed here.
        router.refresh();
      }
    };

    return startCountPoll({
      read: async () => {
        const n = await readUnreadNotificationCount(supabase, userId);
        if (n === null && !reported) {
          // Report the first refusal per mount (no user-facing toast) so a
          // sustained failure — e.g. an RLS regression on notifications — is
          // visible in Connection Logs without a report every minute.
          reported = true;
          void trackFailure({
            eventType: 'OTHER',
            elementName: 'Unread notifications badge',
            filePath: 'app/_components/unread-bell-badge.tsx',
            error: new Error('unread notification count could not be read'),
            payload: { query: 'readUnreadNotificationCount' },
          });
        }
        return n;
      },
      onValue: (n) => {
        const rose = n > shown.current;
        setUnread(n);
        if (rose) void checkArrivals();
      },
    });
  }, [userId, router]);

  const label = unread > 0 ? `${ariaBaseLabel} · ${unread} ${ariaUnreadSuffix}` : ariaBaseLabel;

  return (
    /* `fd-round`: the shared bar draws it as a 44px circle below 768 (front-door.css). */
    <Link
      href={href}
      aria-label={label}
      className="fd-round relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700"
    >
      <Bell className="h-4 w-4" strokeWidth={1.75} />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-terracotta-700 px-1 font-mono text-[9px] font-semibold text-cream"
          style={
            pulse
              ? { animation: 'sn-pulse 1.7s infinite, sn-ring 2.6s infinite' }
              : undefined
          }
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
