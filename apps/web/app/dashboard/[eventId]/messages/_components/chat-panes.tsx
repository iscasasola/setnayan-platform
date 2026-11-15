'use client';

/**
 * 💬 CHAT · THE LIST BESIDE THE OPEN THREAD FROM 701 (owner 2026-11-13, D3: *"chat shows the list and the open thread
 * side by side from 701; the phone stays full-screen"*). Both trees, one wrapper — and the two columns are the system's
 * (`SupplierColumns` / `.sn-cols`, list · opened item), never a chat-only copy of them.
 *
 *   · 📱 below 701 nothing moves: the list is the page, and an open thread is the full-screen takeover over it
 *     (globals.css "AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE"). While a thread is open the list column steps
 *     aside and the pane — which `.sn-cols` does not draw on a phone — is drawn, so the takeover is what you see.
 *   · 🖥 from 701 the list is the left column and the open thread is the right one.
 *   · 🔒 NEVER AN EMPTY RIGHT COLUMN. On the list's own address (no thread open) the right column shows the thread's own
 *     arrival (`ThreadArrival`, its `loading.tsx`) and the latest chat is opened into it (`latestHref`) — the way
 *     Messenger opens its newest conversation. With no chat to open (`latestHref` null) the page does not split at all
 *     and keeps its one column, as `SupplierColumns` says a page with nothing honest for the pane must.
 *
 * The phone never opens anything by itself: the latest chat is opened only while the window is 701 or wider, so a
 * phone's list is never replaced by a thread it did not tap (and never marked read unseen).
 * 🔒 lib/the-chat-is-messenger-shaped.test.ts
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SupplierColumns } from '@/app/vendor-dashboard/_components/supplier-columns';
import { fitChatPane } from './chat-pane-fit';

/** The system's tablet line — `tab:` in tailwind.config, `.sn-cols` in supplier-frame.css. */
export const CHAT_PANES_FROM = '(min-width: 701px)';

export function ChatPanes({
  list,
  children,
  open,
  latestHref = null,
}: {
  /** The chats list — the page's own `ChatInbox`, every row as on the phone. */
  list: ReactNode;
  /** The right column: the open thread, or (list address) the thread's arrival while the latest one opens. */
  children: ReactNode;
  /** A thread is open (the thread route). */
  open: boolean;
  /** List address only: the newest chat, opened into the right column from 701. Null = nothing to open → one column. */
  latestHref?: string | null;
}) {
  const router = useRouter();
  // List address only: the arrival is mounted from 701 and never on a phone — it is a takeover, and a hidden one would
  // still lift the phone's page (`.sn-vt-page:has([data-chat-takeover])`).
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (open || !latestHref) return;
    const mq = window.matchMedia(CHAT_PANES_FROM);
    const go = () => {
      setWide(mq.matches);
      if (mq.matches) router.replace(latestHref, { scroll: false });
    };
    go();
    mq.addEventListener('change', go);
    return () => mq.removeEventListener('change', go);
  }, [open, latestHref, router]);

  /*
    📏 THE PANE ENDS AT THE WINDOW'S FOOT — sized from its own top on screen (`fitChatPane`), never from a model of what
    stands above it (W1, live f896598, RW-330: the pane at y≈173, sized as if at 93; the composer under the fold).
    Re-read on load, resize, scroll (sticky: it rises to the pin line) and any change in the page's height (a strip that
    arrives late, its "Got it").
  */
  const ref = useRef<HTMLDivElement>(null);
  const splits = open || Boolean(latestHref);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitChatPane(root));
    };
    fitChatPane(root);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      watch?.disconnect();
    };
  }, [splits]);

  if (!splits) return <>{list}</>;
  return (
    <div ref={ref} data-chat-panes="" {...(open ? { 'data-chat-open': '' } : {})}>
      <SupplierColumns name="chats" list={list} pane={open || wide ? children : null} paneLabel="The open chat" />
    </div>
  );
}
