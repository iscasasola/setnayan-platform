'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * ‹ RETURNS TO THE LIST, IN PLACE (owner 2026-10-28: tap an event → its chat full screen, ‹ back to the list). A link
 * to the list would reload it at the top; when this tab came to the chat FROM a chat list (marked by
 * {@link ChatOriginMark}), ‹ is the browser's own back — the list comes back where it was scrolled. Otherwise (a deep
 * link, a notification) it is the plain link to the list.
 */
const KEY = 'sn-chat-origin';

export function ChatBack({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label="Back to Chats"
      className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-sn-accent hover:bg-ink/5"
      onClick={(e) => {
        let from: string | null = null;
        try {
          from = window.sessionStorage.getItem(KEY);
        } catch {
          from = null;
        }
        if (from && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      data-chat-back=""
    >
      <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2} />
    </Link>
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
