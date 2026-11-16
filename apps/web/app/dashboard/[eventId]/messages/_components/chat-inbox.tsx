'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SquarePen } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ThumbDock } from '@/components/thumb-dock';
import { Sheet } from '@/app/_components/sheet';
import { ThreadListAvatar } from '@/app/_components/chat/thread-list-card';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { searchInboxRows } from '@/lib/chat-inbox-search';
import { markChatViewer } from '@/lib/chat-last-known';
import { ChatOriginMark } from '@/app/_components/chat/chat-back';
import { formatCount } from '@/lib/format-number';
import { messengerOrder, NEEDS_YOU_DOT_LABEL, type ChatsRowNeedsYou } from '@/lib/chats-by-event';
import { rememberPickedOrigin } from '@/app/_components/picked/picked-motion';
import type { ChatLeftRead } from '@/lib/chat-members';
import { LeftChatRow } from '@/app/_components/chat/left-chat-row';
import { CHAT_PANES_FROM } from './chat-panes';

/**
 * THE CHATS INBOX, MESSENGER-SHAPED (owner 2026-10-27, *"look and feel like Messenger"*; chat prototype 2026-10-28,
 * frames A + L) — a big title, All · Unread · Suppliers, one row per chat with NO frame (round avatar · name · its event ·
 * the last line, "You: …" when yours · the time · bold + a dot when unread), and the search in the frosted THUMB ROW
 * at the bottom with ✎ beside it (owner: *"thumb bar"*).
 *
 * Every row arrives built on the server (`buildCoupleConversationRows`, the SAME rows the thread page's column uses);
 * filtering and searching are pure functions over them, so a chip or a letter costs no round trip.
 *
 * 🔒 ONE EVENT, ONE THREAD (owner 2026-10-28, *"i want isolation per event"*): each row carries its event line
 * (date · event name); nothing here merges two events' threads.
 *
 * ✎ opens "Message a supplier" — THIS EVENT's suppliers only (frame K; owner: *"users can only chat a supplier inside an
 * event"*). The list itself is the page's (`newMessage`), so the action that opens a thread stays the shipped one.
 *
 * 💬 THE SUPPLIER'S CHATS READ THIS SAME INBOX (owner 2026-11-06: *"The chat page is a full screen page, correct?
 * Independent of any other menus? Why is it still jumping to customer events"* — `vendor-dashboard/messages`). Three
 * props let the one component serve both sides without a second copy:
 *   · `newMessage` is optional — a supplier answers chats, it does not start them, so no ✎ and no sheet;
 *   · `peerFilter` names the third chip ("Suppliers" for the couple) — `null` draws All · Unread only;
 *   · `dock="foot"` — on a FULL-SCREEN page (`data-chat-takeover`, which covers the shell and its bottom dock) the thumb
 *     row stands at the page's own foot instead of being portalled onto a dock the takeover covers.
 *
 * ✉️ 🪞 MESSENGER ORDER, BOTH SIDES (Supplier Build 3 · Lane A, 9 Nov 2026 — owner 8 Nov: *"the most recent conversation
 * will be the one on top. above it will be pinned messages if unread"*; the host's list keeps *"the same ordering
 * rule"*): unread rows are pinned on top under "Unread · pinned", then "Recent" (`messengerOrder`, lib/chats-by-event.ts).
 * A row that opens a PICKED page (`opensPicked` — the supplier's picked client on Chat, the host's picked supplier on
 * Chat) records where it was tapped, so that page rises from the row and ✕ is the exact reverse back into it.
 * 🚦 A row may carry a "needs you" level (DECISION_LOG 2026-11-09): a dot, the blocker's stronger than due-now.
 *
 * 🖥 FROM 701 A ROW OPENS BESIDE THE LIST (owner 2026-11-13, D3 — `./chat-panes.tsx`): a row's `paneHref` is its thread
 * route, which draws this list on the left and the thread on the right. Below 701 the row's own `href` (the full-screen
 * thread, or the picked page) is unchanged. The row open on the right is marked (`aria-current`, the system's opened-row
 * wash) and reads as read — it is on screen.
 */

export type InboxRow = {
  threadId: string;
  href: string;
  name: string;
  logoUrl: string | null;
  preview: string;
  timeLabel: string;
  unread: boolean;
  /** "Dec 18 · Claire & Indalecio" — the event this one thread belongs to, beside the name (frame L). */
  eventLine: string;
  archived: boolean;
  /** Archive / unarchive — the shipped per-row form, drawn by the page. */
  archive: ReactNode;
  /** The row opens a picked page (`PickedShell`) over this list — its tap is recorded for the rise and the reverse. */
  opensPicked?: boolean;
  /** 🚦 Lane B's `needsYouLevel()` for this row's client — absent/null draws no dot (never a guessed one). */
  needsYou?: ChatsRowNeedsYou | null;
  /**
   * 🚪 You LEFT this chat (owner, 9 Nov): the row stays, greyed, never removed; a tap asks "Join this chat again?".
   * Lane B's thread-member `left_at` / `left_note`; `'unread'` = that read was refused (the pop-up says so). Drawn only
   * when the inbox is handed `join`.
   */
  left?: ChatLeftRead | null;
  /** 🖥 The thread route this row opens in the right column from 701 (`ChatPanes`). Absent = the row's `href` at every width. */
  paneHref?: string;
};

type Filter = 'all' | 'unread' | 'suppliers';

/** The two group heads (✉️): small caps, quiet — words, not frames. */
const GROUP_HEAD = 'pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50';

export function ChatInbox({
  rows,
  viewerId,
  newMessage,
  empty,
  unreadMeasured = true,
  peerFilter = 'Suppliers',
  dock = 'float',
  join = null,
}: {
  rows: InboxRow[];
  /** 🚪 Join a chat you left again — the writer posts "[name] joined". Absent → a left row is drawn as any other. */
  join?: ((threadId: string) => Promise<void>) | null;
  /** 🔌 False when the unread read was refused — the Unread filter then says it could not check, never "Nothing unread." */
  unreadMeasured?: boolean;
  viewerId: string;
  /** The ✎ sheet's body — this event's suppliers. Absent = no ✎ (the supplier's Chats: it answers, it does not start). */
  newMessage?: ReactNode;
  /** What an inbox with no chats says (the page's own words and door). */
  empty: ReactNode;
  /** The third chip's word ("Suppliers"); `null` = All · Unread only. */
  peerFilter?: string | null;
  /** `float` — portalled onto the bottom dock (a page inside the shell); `foot` — at the page's own foot (a full-screen
   *  page whose takeover covers that dock). */
  dock?: 'float' | 'foot';
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const headingId = useId();
  const router = useRouter();
  const pathname = usePathname();
  // 🖥 From 701 a row with a thread route opens it beside this list; a modified click keeps the browser's own meaning.
  const openInPane = (e: MouseEvent<HTMLAnchorElement>, paneHref: string | undefined): boolean => {
    if (!paneHref || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!window.matchMedia(CHAT_PANES_FROM).matches) return false;
    e.preventDefault();
    router.push(paneHref, { scroll: false });
    return true;
  };
  useEffect(() => {
    setMounted(true);
    // The thread's instant open paints remembered messages only for the viewer this page has marked.
    markChatViewer(viewerId);
  }, [viewerId]);

  const unreadCount = rows.filter((r) => r.unread && !r.archived).length;
  const shown = useMemo(() => {
    const byFilter = rows.filter((r) => (filter === 'unread' ? r.unread : true));
    return searchInboxRows(byFilter, query);
  }, [rows, filter, query]);
  const active = shown.filter((r) => !r.archived);
  const archived = shown.filter((r) => r.archived);
  // ✉️ Unread pinned on top, then the most recent (rows arrive newest first) — `lib/chats-by-event.ts`.
  const { pinned, recent } = messengerOrder(active);

  // 🫧 The thumb row eases to ~70 % while the page scrolls, and back ~300 ms after it stops (owner 2026-10-27, "every
  // thumb row is frosted glass — a little more see-through while scrolling").
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let t = 0;
    const onScroll = () => {
      dockRef.current?.setAttribute('data-scrolling', '');
      window.clearTimeout(t);
      t = window.setTimeout(() => dockRef.current?.removeAttribute('data-scrolling'), 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
    };
  }, []);

  const chip = (key: Filter, label: string, count?: number) => (
    <button
      key={key}
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={`${pillSegClass(filter === key)} flex-1 px-3`}
    >
      {label}
      {count ? <span className="font-mono text-[0.65rem] font-normal opacity-85">{formatCount(count)}</span> : null}
    </button>
  );

  const renderRow = (r: InboxRow) => {
    const isOpen = Boolean(r.paneHref) && pathname === r.paneHref;
    const unread = r.unread && !isOpen;
    return r.left && join ? (
      <LeftChatRow key={r.threadId} threadId={r.threadId} href={r.href} name={r.name} logoUrl={r.logoUrl} preview={r.preview} timeLabel={r.timeLabel} left={r.left} join={join} />
    ) : (
    <li
      key={r.threadId}
      className="flex items-center"
      data-inbox-row={unread ? 'unread' : 'read'}
      {...(r.needsYou ? { 'data-inbox-needs-you': r.needsYou } : {})}
      {...(isOpen ? { 'data-open-row': '', 'data-open-current': '' } : {})}
    >
      <Link
        href={r.href}
        prefetch
        aria-current={isOpen ? 'page' : undefined}
        className="sn-press flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2"
        onClick={r.paneHref ? (e) => void openInPane(e, r.paneHref) : undefined}
        onClickCapture={
          r.opensPicked
            ? (e) => {
                if (r.paneHref && window.matchMedia(CHAT_PANES_FROM).matches) return;
                rememberPickedOrigin(e.currentTarget.closest('li'), r.href.split('?')[0]!);
              }
            : undefined
        }
      >
        {/* 🚦 Needs you — a badge on the avatar's corner, apart from the unread dot at the row's end (two meanings, two
            places). The blocker's is the stronger: larger, danger, ringed; due-now is the smaller amber one. */}
        <span className="relative shrink-0">
          <ThreadListAvatar logoUrl={r.logoUrl} name={r.name} size="lg" />
          {r.needsYou === 'blocker' ? (
            <span role="img" aria-label={NEEDS_YOU_DOT_LABEL.blocker} title={NEEDS_YOU_DOT_LABEL.blocker} className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-danger-600 ring-2 ring-cream" data-needs-you-dot="blocker" />
          ) : r.needsYou === 'due-now' ? (
            <span role="img" aria-label={NEEDS_YOU_DOT_LABEL['due-now']} title={NEEDS_YOU_DOT_LABEL['due-now']} className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-warn-500 ring-2 ring-cream" data-needs-you-dot="due-now" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {/* With an event line beside it the name keeps 70 %; a name that IS the event line (the supplier's chat title,
                "Ana's Wedding (Dec 12)") takes the whole width, so its date is not the part that gets cut. */}
            <span className={`min-w-0 ${r.eventLine ? 'shrink-0' : 'shrink'} truncate text-[16px] text-ink ${unread ? 'font-bold' : 'font-medium'}`} style={r.eventLine ? { maxWidth: '70%' } : undefined}>{r.name}</span>
            {/* Frame L (owner 2026-10-28, "i want isolation per event"): each row says WHICH event — "· Dec 18 · …". */}
            {r.eventLine ? (
              <span className="min-w-0 shrink truncate text-[11px] font-semibold text-sn-accent" data-inbox-event-line="">
                · {r.eventLine}
              </span>
            ) : null}
          </span>
          <span className={`block truncate text-[14px] ${unread ? 'font-bold text-ink' : 'text-ink/60'}`}>
            {r.preview} · {r.timeLabel}
          </span>
        </span>
        {unread ? <span aria-label="Unread" className="h-3 w-3 shrink-0 rounded-full bg-sn-accent" /> : null}
      </Link>
      {r.archive}
    </li>
    );
  };

  const sheet = (
    <Sheet open={composing} onClose={() => setComposing(false)} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5" data-new-message-sheet="">
        <h2 id={headingId} className="pr-12 text-[20px] font-semibold text-ink">
          Message a supplier
        </h2>
        {newMessage}
      </div>
    </Sheet>
  );

  const thumb = (
    <div ref={dockRef} className="transition-opacity duration-300 data-[scrolling]:opacity-70 motion-reduce:transition-none" data-chat-inbox-thumb="">
      <ThumbRow
        name="chats"
        field={{
          placeholder: 'Search chats',
          label: 'Search chats by name',
          input: {
            type: 'search',
            value: query,
            onChange: (e) => setQuery(e.currentTarget.value),
            'data-chat-inbox-search': '',
          },
        }}
        action={
          newMessage
            ? { icon: SquarePen, label: 'New message', onClick: () => setComposing(true), testId: 'chat-new-message' }
            : null
        }
      />
    </div>
  );

  return (
    <div data-chat-inbox="" className={dock === 'foot' ? 'flex min-h-full flex-1 flex-col' : undefined}>
      <ChatOriginMark />
      {/* Mounted FIRST: from 1024 the row is the column's first line (ThumbDock draws it in place); on a phone it is
          portalled onto the bottom dock, where it arrives last. On a full-screen page (`foot`) it is the page's own
          last line instead — see the foot below. */}
      {dock === 'float' ? <ThumbDock>{thumb}</ThumbDock> : null}
      <div className="mb-2 mt-1">
        <div role="group" aria-label="Show" className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} w-full`}>
          <PillThumb />
          {chip('all', 'All')}
          {chip('unread', 'Unread', unreadCount)}
          {peerFilter ? chip('suppliers', peerFilter) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        empty
      ) : active.length > 0 ? (
        pinned.length > 0 && filter !== 'unread' ? (
          <>
            <p className={GROUP_HEAD} data-inbox-group="unread">Unread · pinned</p>
            <ul data-inbox-pinned="">{pinned.map(renderRow)}</ul>
            {recent.length > 0 ? (
              <>
                <p className={`${GROUP_HEAD} mt-2`} data-inbox-group="recent">Recent</p>
                <ul>{recent.map(renderRow)}</ul>
              </>
            ) : null}
          </>
        ) : (
          <ul>{active.map(renderRow)}</ul>
        )
      ) : (
        <p className="py-6 text-center text-sm text-ink/60">
          {query.trim()
            ? `No chat matches “${query.trim()}”.`
            : filter === 'unread'
              ? unreadMeasured
                ? 'Nothing unread.'
                : 'We couldn’t check which chats are unread. Reload in a moment.'
              : 'No active chats — everything’s in Archived below.'}
        </p>
      )}

      {archived.length > 0 ? (
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-medium text-ink/60 hover:text-ink">
            Archived · <span className="ml-1 font-mono">{archived.length}</span>
          </summary>
          <ul>{archived.map(renderRow)}</ul>
        </details>
      ) : null}

      {/* 🦶 THE FOOT — a full-screen page's thumb row, pinned to the bottom of the page itself (the takeover is the
          scroller, so `sticky` holds it at the screen's foot; `mt-auto` takes it there when the list is short). Drawn
          once mounted, like the floating dock: the row's field ids come from `useId`, and a server-drawn row
          hydrated with mismatched ids (measured in the lab, 2026-11-06). */}
      {dock === 'foot' && mounted ? (
        <div className="sticky bottom-0 z-10 mt-auto pb-[max(10px,env(safe-area-inset-bottom))] pt-2" data-chat-inbox-foot="">
          {thumb}
        </div>
      ) : null}

      {mounted && newMessage ? createPortal(sheet, document.body) : null}
    </div>
  );
}
