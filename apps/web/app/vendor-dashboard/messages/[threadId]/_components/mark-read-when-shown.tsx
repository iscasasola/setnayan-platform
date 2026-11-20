'use client';

import { useContext, useEffect } from 'react';
import { markThreadRead } from '@/lib/chat-actions';
import { PickedCoveredContext } from '@/app/_components/picked/picked-nav';

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
 *
 * 💬 Since 19 Nov 2026 the chat is the client page's HOME: it stays mounted while another page is risen over it (a
 * `?tab=payments` door opens Book & Budget over the chat). Mounted is then not shown — so the marker waits while the
 * chat is covered (`PickedCoveredContext`) and writes the moment the risen page closes.
 */
export function MarkReadWhenShown({ threadId }: { threadId: string }) {
  const covered = useContext(PickedCoveredContext);
  useEffect(() => {
    if (covered) return;
    void markThreadRead(threadId).catch(() => undefined);
  }, [threadId, covered]);
  return null;
}
