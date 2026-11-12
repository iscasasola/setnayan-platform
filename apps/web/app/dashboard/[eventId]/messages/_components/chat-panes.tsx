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
    📏 THE PANE ENDS AT THE WINDOW'S FOOT. `.sn-cols-pane` is `100vh − the pin line` tall, which is right when the page's
    column starts AT the pin line (the supplier tree). The couple's column starts its own gutter below it (24 px), so the
    pane ran that far past the window and the composer sat under the fold (measured 2026-11-12: y 1040 in a 1024 window
    at 768). The gap is measured, never guessed, and only the chat's pane reads it (globals.css).
  */
  const ref = useRef<HTMLDivElement>(null);
  const splits = open || Boolean(latestHref);
  useLayoutEffect(() => {
    const root = ref.current;
    const pane = root?.querySelector<HTMLElement>('[data-supplier-cols-pane]');
    if (!root || !pane) return;
    const measure = () => {
      const pin = parseFloat(getComputedStyle(pane).top) || 0;
      const at = root.getBoundingClientRect().top + window.scrollY;
      root.style.setProperty('--sn-chat-pane-gap', `${Math.max(0, Math.round(at - pin))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [splits]);

  if (!splits) return <>{list}</>;
  return (
    <div ref={ref} data-chat-panes="" {...(open ? { 'data-chat-open': '' } : {})}>
      <SupplierColumns name="chats" list={list} pane={open || wide ? children : null} paneLabel="The open chat" />
    </div>
  );
}
