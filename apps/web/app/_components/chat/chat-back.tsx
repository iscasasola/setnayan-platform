'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

/**
 * ‹ RETURNS TO THE LIST, IN PLACE (owner 2026-10-28: tap an event → its chat full screen, ‹ back to the list). The ‹
 * itself is the shared `BackButton` (`variant="chat"`, its link from `lib/page-home.ts`); this wraps it. When this tab
 * came to the chat FROM a chat list (marked by {@link ChatOriginMark}), the press is the browser's own back — the list
 * comes back where it was scrolled. Otherwise (a deep link, a notification) the link goes to the page's home.
 */
const KEY = 'sn-chat-origin';

export function ReturnInPlace({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <span
      className="contents"
      onClickCapture={(e) => {
        let from: string | null = null;
        try {
          from = window.sessionStorage.getItem(KEY);
        } catch {
          from = null;
        }
        if (from && window.history.length > 1) {
          // Captured before the link's own handler, which honours a prevented default and does not navigate.
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </span>
  );
}

/** Mounted by a chat list: "this tab is on a list of chats now" — so the chat's ‹ can go back to it in place. */
export function ChatOriginMark() {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
    } catch {
      /* storage refused — ‹ is the plain link */
    }
  }, []);
  return null;
}
