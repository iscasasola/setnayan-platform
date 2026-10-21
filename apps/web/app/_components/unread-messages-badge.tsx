'use client';

// Unread-message badge for the Messages icon (MessageSquare) in the couple's
// event bar and the supplier's bar. Shipped icon-only in PR #837; this adds the
// count.
//
// Mirrors UnreadBellBadge: starts from a server-rendered count (accurate first
// paint, no client roundtrip), then RE-ASKS the count on a slow timer while the
// tab is in view, and at once when the person comes back to the tab
// (`pollEnvelope` → `startCountPoll`, lib/unread-polls.ts · lib/tab-return.ts).
//
// 🔌 NO SOCKET (2026-10-21, live connections only where live). It used to
// subscribe to EVERY `chat_messages` INSERT the user could see, over Supabase
// Realtime, from every plain page of two whole trees — a websocket held open
// all day in every tab, to move a badge. The conversation itself stays live:
// an open thread streams its messages (`ChatMessageStream`).
//
// 🧯 A burst of messages used to fire one count RPC per message (then one per
// burst — `settleBurst`). A timer asks at most once per minute, whatever lands.
//
// 🔒 A FAILED READ CHANGES NOTHING. `readUnreadMessageThreads` answers `null`
// when it could not read (and when the read-marker function is missing), and
// the poll never hands `null` on — the drawn count stands; never a false 0.

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Props = {
  userId: string;
  initialUnread: number;
  href: string;
};

export function UnreadMessagesBadge({ userId, initialUnread, href }: Props) {
  const [unread, setUnread] = useState(initialUnread);

  // A fresh server render (a revalidated layout, a router.refresh) wins.
  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    // The poll is loaded once the envelope is on screen (`lib/unread-polls.ts`) — off the first load of every page.
    let stop: (() => void) | null = null;
    let gone = false;
    void import('@/lib/unread-polls').then(({ pollEnvelope }) => {
      if (!gone) stop = pollEnvelope({ supabase: createClient(), onValue: setUnread });
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [userId]);

  const label = unread > 0 ? `Messages · ${unread} unread messages` : 'Messages';

  return (
    /* `fd-round`: the shared bar draws it as a 44px circle below 768 (front-door.css). */
    <Link
      href={href}
      aria-label={label}
      className="fd-round relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700"
    >
      <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-terracotta-700 px-1 font-mono text-[9px] font-semibold text-cream"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
