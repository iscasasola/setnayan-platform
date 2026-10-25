'use client';

// Unread-notification badge for the top-nav bell (every signed-in layout).
//
// The badge starts from a server-rendered count (so the first paint is
// accurate without a client roundtrip) and then RE-ASKS the count on a slow
// timer while the tab is in view, and at once when the person comes back to
// the tab (`pollBell` → `startCountPoll`, lib/unread-polls.ts · lib/tab-return.ts).
//
// 🔌 NO SOCKET (2026-10-21, live connections only where live). It used to
// subscribe to `notifications` over Supabase Realtime — and because the bell is
// in every signed-in layout, every plain page held a websocket open all day, in
// every tab. A badge is not a conversation: a minute's delay is invisible, and
// coming back to the tab asks at once.
//
// 🔔 THE BELL OPENS A POP-OVER (owner 2026-10-25: "shouldn't it be a pop up to see the notifications and an option
// to view all?" · "Build it" on `prototypes/notifications_popover_2026-10-25`). It used to be a plain link to the
// notifications page. It is now a button: desktop, a card under the bell; phone, the house bottom sheet — both built
// exactly like the account menu's `renderPanel()` (account-switcher.tsx), over `OverlayBackdrop` (a tap on the dark
// closes it) with `useModalA11y`. Inside: "Notifications" + a quiet "Mark all read", the latest 8 rows (the SAME
// `NotificationsList` the page draws), and "View all" to `href` — the one prop that differs between the couple,
// supplier and admin bells. The rows are read when it OPENS (`fetchOwnNotifications`, limit 8), never on page load.
//
// 🔒 A FAILED READ CHANGES NOTHING. `readUnreadNotificationCount` answers `null`
// when it could not read, and the poll never hands `null` on — so a refused or
// dropped read leaves the drawn count standing instead of a false 0.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { NotificationRow, NotificationType } from '@/lib/notifications';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import dynamic from 'next/dynamic';

/*
  The pop-over's rows ride in a chunk of their own, fetched when the bell is first pressed — the bell is in the first
  load of every signed-in page, and nothing in the list is needed to draw it (the same posture as the count poll).
*/
const NotificationsHead = dynamic(
  () => import('@/app/_components/notifications/notifications-list').then((m) => m.NotificationsHead),
  { ssr: false },
);
const NotificationsList = dynamic(
  () => import('@/app/_components/notifications/notifications-list').then((m) => m.NotificationsList),
  { ssr: false },
);

/**
 * 🔑 BEING MADE A HOST CHANGES WHAT AN OPEN PAGE SHOULD SHOW (owner 2026-09-28:
 * "they do not need to resign in. it should auto refresh"). An INVITATION
 * changes the Events page too: its Incoming requests section appears without a
 * reload. When the count goes UP the bell asks whether one of these arrived,
 * and refreshes the server render if so — no reload, nothing typed is lost.
 */
const PAGE_CHANGING_TYPES: readonly NotificationType[] = ['cohost_added', 'event_invitation'];

type Props = {
  userId: string;
  initialUnread: number;
  /** The pop-over's "View all" — the couple's, the supplier's or the console's notifications page. */
  href: string;
  ariaBaseLabel: string;
  ariaUnreadSuffix: string;
  /** OPT-IN live pulse + expanding gold ring on the unread badge (home-launcher
   *  pixel pass 2026-07-15; proto bell dot pulse/ringGold). Off by default so
   *  the component's other mounts are unchanged. The global reduced-motion
   *  freeze caps both animations to a single instant run. */
  pulse?: boolean;
  /** DEV LABS ONLY (`/dev/notifications-lab`, no sign-in): the rows the pop-over draws instead of reading them. */
  labRows?: NotificationRow[];
};

export function UnreadBellBadge({
  userId,
  initialUnread,
  href,
  ariaBaseLabel,
  ariaUnreadSuffix,
  pulse = false,
  labRows,
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
    // The poll is loaded once the bell is on screen (`lib/unread-polls.ts`) — nothing in it is needed for the first
    // paint, and the bell is in the first load of every signed-in page.
    let stop: (() => void) | null = null;
    let gone = false;
    void import('@/lib/unread-polls').then(({ pollBell }) => {
      if (gone) return;
      stop = pollBell({
        supabase: createClient(),
        userId,
        shown: () => shown.current,
        onValue: setUnread,
        refreshOn: PAGE_CHANGING_TYPES,
        onArrival: () => {
          // one-render: keep (realtime) — a poll saw a notification arrive (made a host / invited); nothing was pressed here.
          router.refresh();
        },
      });
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [userId, router]);

  // ── the pop-over ──
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** undefined = not read yet · null = could not read · rows = the latest eight. */
  const [rows, setRows] = useState<NotificationRow[] | null | undefined>(undefined);
  const [here, setHere] = useState('/');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
  }

  useModalA11y({ open, onClose: close, containerRef: panelRef });

  // A row that lands somewhere else closes the pop-over when the page changes under it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setHere(`${window.location.pathname}${window.location.search}`);
    if (labRows) {
      setRows(labRows);
      return;
    }
    /*
      The latest eight, read in the browser through the page's own `fetchOwnNotifications` (RLS: your own rows) — the
      same client the count poll reads with, and no server action. It throws on a refused read; that is `null` here,
      so a failure is said, never drawn as "You're all caught up".
    */
    void (async () => {
      try {
        const { fetchOwnNotifications } = await import('@/lib/notifications');
        const r = await fetchOwnNotifications(createClient(), userId, 8);
        if (live) setRows(r);
      } catch {
        if (live) setRows(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [open, labRows, userId]);

  function markedRead(id: string) {
    const at = new Date().toISOString();
    setRows((rs) => rs?.map((r) => (r.notification_id === id && !r.read_at ? { ...r, read_at: at } : r)) ?? rs);
    setUnread((u) => Math.max(0, u - 1));
  }

  function markedAllRead() {
    const at = new Date().toISOString();
    setRows((rs) => rs?.map((r) => (r.read_at ? r : { ...r, read_at: at })) ?? rs);
    setUnread(0);
  }

  const label = unread > 0 ? `${ariaBaseLabel} · ${unread} ${ariaUnreadSuffix}` : ariaBaseLabel;
  // The badge's count covers notices older than the eight drawn, so either one keeps "Mark all read" on show.
  const rowsUnread = rows ? Math.max(unread, rows.filter((r) => !r.read_at).length) : 0;

  function renderPanel() {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        data-notifications-popover=""
        className={[
          'focus:outline-none',
          // Phone: the house bottom sheet (account-switcher.tsx renderPanel(), the same classes).
          'fixed inset-x-0 bottom-0 z-[52] flex max-h-[90vh] pl-[var(--sn-safe-l)] pr-[var(--sn-safe-r)] flex-col overflow-hidden rounded-t-2xl border-t border-ink/10 sn-sheet pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl',
          // Desktop: the account menu's card, under the bar. The underscores in the calc() are load-bearing — see
          // account-switcher.tsx (without them the panel lands 2,213px down the page).
          'lg:inset-x-auto lg:bottom-auto lg:right-[max(0.75rem,var(--sn-safe-r))] lg:pl-0 lg:pr-0 lg:top-[calc(var(--fd-bar,56px)_+_8px)] lg:w-80 lg:max-h-[min(80vh,34rem)] lg:rounded-2xl lg:border lg:border-ink/10 lg:pb-0', // no-card-ok: the pop-over's own surface, copied from the account menu
        ].join(' ')}
        style={{ animation: 'sn-bell-in 0.3s ease' }}
      >
        <style>{`
          .sn-sheet{background:var(--m-paper-2)}
          html.dark .sn-sheet{background:rgb(var(--color-cream))}
          @keyframes sn-bell-in {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @media (min-width: 1024px) {
            @keyframes sn-bell-in {
              from { transform: translateY(-8px); opacity: 0; }
              to   { transform: translateY(0); opacity: 1; }
            }
          }
        `}</style>

        {/* Drag handle (phone only) */}
        <div aria-hidden className="mx-auto mb-1.5 mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--m-line)] lg:hidden" />

        <NotificationsHead unreadCount={rowsUnread} returnTo={here} level="popover" onMarkAll={markedAllRead} />

        <div className="min-h-0 flex-1 overflow-y-auto pb-1" aria-busy={rows === undefined || undefined}>
          {rows === undefined ? (
            <div className="mx-3 mt-8 h-[186px] rounded-tile bg-[var(--m-paper)] opacity-60" data-notifications-loading="" />
          ) : rows === null ? (
            <div className="px-5 pb-6 pt-7 text-center" data-notifications-failed="">
              <p className="text-[15px] font-semibold text-ink">These did not load</p>
              <p className="mt-1 text-[13px] text-[var(--m-slate-2)]">View all to try again.</p>
            </div>
          ) : (
            <NotificationsList
              items={rows}
              returnTo={here}
              onRead={markedRead}
              inset="popover"
              emptyState={{ title: 'You\u2019re all caught up', body: 'New notices land here.' }}
            />
          )}
        </div>

        <div className="mt-2 flex-none border-t border-[var(--m-line)]">
          <Link
            href={href}
            onClick={close}
            className="flex min-h-12 items-center justify-center gap-1 text-sm font-semibold text-[var(--m-nav-active)]"
            data-notifications-view-all=""
          >
            View all
            <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* `fd-round`: the shared bar draws it as a 44px circle below 768 (front-door.css). */}
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-notification-bell=""
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
      </button>

      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              <OverlayBackdrop onClose={close} label="Close notifications" className="z-[51]" />
              {renderPanel()}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
