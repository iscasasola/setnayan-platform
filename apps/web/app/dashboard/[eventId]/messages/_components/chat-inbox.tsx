'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SquarePen } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ThumbDock } from '@/components/thumb-dock';
import { Sheet } from '@/app/_components/sheet';
import { ThreadListAvatar } from '@/app/_components/chat/thread-list-card';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { searchInboxRows } from '@/lib/chat-inbox-search';
import { markChatViewer } from '@/lib/chat-last-known';
import { formatCount } from '@/lib/format-number';

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
};

type Filter = 'all' | 'unread' | 'suppliers';

export function ChatInbox({
  rows,
  viewerId,
  newMessage,
  empty,
}: {
  rows: InboxRow[];
  viewerId: string;
  /** The ✎ sheet's body — this event's suppliers. */
  newMessage: ReactNode;
  /** What an inbox with no chats says (the page's own words and door). */
  empty: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const headingId = useId();
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

  const renderRow = (r: InboxRow) => (
    <li key={r.threadId} className="flex items-center" data-inbox-row={r.unread ? 'unread' : 'read'}>
      <Link href={r.href} prefetch className="sn-press flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2">
        <ThreadListAvatar logoUrl={r.logoUrl} name={r.name} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className={`min-w-0 shrink-0 truncate text-[16px] text-ink ${r.unread ? 'font-bold' : 'font-medium'}`} style={{ maxWidth: '70%' }}>{r.name}</span>
            {/* Frame L (owner 2026-10-28, "i want isolation per event"): each row says WHICH event — "· Dec 18 · …". */}
            {r.eventLine ? (
              <span className="min-w-0 shrink truncate text-[11px] font-semibold text-sn-accent" data-inbox-event-line="">
                · {r.eventLine}
              </span>
            ) : null}
          </span>
          <span className={`block truncate text-[14px] ${r.unread ? 'font-bold text-ink' : 'text-ink/60'}`}>
            {r.preview} · {r.timeLabel}
          </span>
        </span>
        {r.unread ? <span aria-label="Unread" className="h-3 w-3 shrink-0 rounded-full bg-sn-accent" /> : null}
      </Link>
      {r.archive}
    </li>
  );

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

  return (
    <div data-chat-inbox="">
      {/* Mounted FIRST: from 1024 the row is the column's first line (ThumbDock draws it in place); on a phone it is
          portalled onto the bottom dock, where it arrives last. */}
      <ThumbDock>
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
            action={{ icon: SquarePen, label: 'New message', onClick: () => setComposing(true), testId: 'chat-new-message' }}
          />
        </div>
      </ThumbDock>
      <div className="mb-2 mt-1">
        <div role="group" aria-label="Show" className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} w-full`}>
          <PillThumb />
          {chip('all', 'All')}
          {chip('unread', 'Unread', unreadCount)}
          {chip('suppliers', 'Suppliers')}
        </div>
      </div>

      {rows.length === 0 ? (
        empty
      ) : active.length > 0 ? (
        <ul>{active.map(renderRow)}</ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink/60">
          {query.trim()
            ? `No chat matches “${query.trim()}”.`
            : filter === 'unread'
              ? 'Nothing unread.'
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

      {mounted ? createPortal(sheet, document.body) : null}
    </div>
  );
}
