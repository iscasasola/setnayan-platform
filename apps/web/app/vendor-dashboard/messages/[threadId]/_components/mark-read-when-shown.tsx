'use client';

import { useEffect } from 'react';
import { markThreadRead } from '@/lib/chat-actions';

/**
 * MARK READ WHEN SHOWN — the picked client's Chat page marks the conversation read; nothing else does.
 *
 * The picked client draws the thread ONCE per open (`askedOnce` in `../page.tsx`, Build 2 lane D) and hands the
 * same draw to Chat, Quotation and Details' Decisions. A server-side `markThreadRead` inside that shared draw ran
 * whichever page was shown — so opening a client's Details or Quotation marked the chat read, and the couple's
 * receipts said "seen" for a conversation nobody had looked at. The shell mounts ONLY the page on screen
 * (`bodies[page]` in `picked-client-shell.tsx`), so this component mounts exactly when Chat is shown — including a
 * swipe to Chat with no request — and writes the marker then. `markThreadRead` does not revalidate, so no second
 * render follows. The full-screen thread route still marks on the server, before its conversation column reads.
 */
export function MarkReadWhenShown({ threadId }: { threadId: string }) {
  useEffect(() => {
    void markThreadRead(threadId).catch(() => undefined);
  }, [threadId]);
  return null;
}
