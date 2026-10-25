'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Bell,
  Calendar,
  Check,
  CheckCheck,
  Gift,
  Image as ImageIcon,
  Loader,
  MessageCircle,
  MoreHorizontal,
  Receipt,
  ShieldCheck,
  Star,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  isTodayNotice,
  notificationIcon,
  notificationShortLabel,
  relativeTimeShort,
  type NotificationIcon,
  type NotificationRow,
} from '@/lib/notifications';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { brandWords } from '@/lib/brand-words';

/**
 * Shared notifications list — THE BELL'S POP-OVER AND ITS "VIEW ALL" PAGE DRAW THE SAME ROWS.
 *
 * Owner, 2026-10-25: *"shouldn't it be a pop up to see the notifications and an option to view all?"* · *"view all
 * notifications simpler"* · approving the prototype: *"Build it"*. The contract is
 * `Setnayan/prototypes/notifications_popover_2026-10-25/index.html`.
 *
 * Extracted 2026-06-14 (dashboard-consolidation dedup, Track A4) so the couple (`/dashboard/notifications`) and
 * supplier (`/vendor-dashboard/notifications`) pages stopped forking one `<ul>`. Since 2026-10-25 the bell's pop-over
 * (`unread-bell-badge.tsx`) renders it too.
 *
 * ── THE ROW (the approved drawing) ─────────────────────────────────────────────────────────────────────────────────
 *   38px icon circle · bold title (two lines at most) · one truncated line · short time ("18h") · gold unread dot.
 *   ⚖ THE WHOLE ROW IS THE PRESS. One `<form action={markNotificationRead}>` whose submit button IS the row: it marks
 *   the notice read and lands on its `related_url` (a notice without one marks read and stays on the page).
 *   Mark read ALONE: swipe the row left on a phone (one quiet "Mark read" shows); on desktop a ⋯ on hover opens a
 *   one-item menu. No coloured type pill, no "Open" / "Mark read" buttons, no frame per row — the type's short name is
 *   the icon's accessible name.
 *   Rows are grouped Today (the last 24 hours) / Earlier, each group one filled surface with hairlines between rows.
 *
 * ⚖ THE MESSAGE STILL GETS ITS OWN LINE (owner, live iPhone review 2026-10-04): the title and the message stack in
 *   one column; the time sits in its own narrow column at the end, never a pill beside the message.
 */

type EmptyState = {
  /** Lead line under the bell icon. */
  title: string;
  /** Body node — JSX so the couple/vendor variants can embed their own links. */
  body: ReactNode;
  /** Optional footer node (e.g. the couple's "Back to events" button). */
  footer?: ReactNode;
};

type Props = {
  /** Already-fetched, user-scoped notification rows (newest first). */
  items: NotificationRow[];
  /**
   * The page the person is on. A row with no `related_url` returns here after it is marked read, and so does the
   * swipe / ⋯ "Mark read". Per surface: `/dashboard/notifications`, `/vendor-dashboard/notifications`, or — in the
   * bell's pop-over — whatever page the bell was pressed on.
   */
  returnTo: string;
  /** Per-surface empty-state copy shown when `items` is empty. */
  emptyState: EmptyState;
  /** Tells the owner a notice was marked read here (the pop-over keeps its own copy of the rows). */
  onRead?: (notificationId: string) => void;
  /** Card side margin: the pop-over's 12px or the page's 16px (the drawing's two insets). */
  inset?: 'popover' | 'page';
};

/** The hairline between rows starts after the icon (12px pad + 38px circle + 12px gap). */
const LIST_CSS = `
.sn-notice-card>li+li::before{content:"";position:absolute;left:62px;right:0;top:0;height:1px;background:var(--m-line);pointer-events:none;z-index:2}
`;

const ICONS: Record<NotificationIcon, LucideIcon> = {
  bell: Bell,
  'user-check': UserCheck,
  message: MessageCircle,
  'user-plus': UserPlus,
  receipt: Receipt,
  check: Check,
  // The drawing's "added" mark is eight short rays — lucide's `Loader` is that exact glyph.
  sparkle: Loader,
  calendar: Calendar,
  image: ImageIcon,
  star: Star,
  shield: ShieldCheck,
  gift: Gift,
};

export function NotificationsList({ items, returnTo, emptyState, onRead, inset = 'page' }: Props) {
  if (items.length === 0) {
    return (
      <div className="px-5 pb-6 pt-7 text-center" data-notice-empty="">
        <span className="mb-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--m-paper)] text-[var(--m-slate-3)]">
          <Bell aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="text-[15px] font-semibold text-ink">{emptyState.title}</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--m-slate-2)]">{emptyState.body}</p>
        {emptyState.footer ? <div className="mt-4">{emptyState.footer}</div> : null}
      </div>
    );
  }

  const now = new Date();
  const today = items.filter((n) => isTodayNotice(n.created_at, now));
  const earlier = items.filter((n) => !isTodayNotice(n.created_at, now));
  const cardMargin = inset === 'popover' ? 'mx-3' : 'mx-4';

  return (
    <div data-notice-list="">
      <style>{LIST_CSS}</style>
      {[
        { key: 'today', label: 'Today', rows: today },
        { key: 'earlier', label: 'Earlier', rows: earlier },
      ].map((group, gi) =>
        group.rows.length === 0 ? null : (
          <section key={group.key} aria-label={group.label}>
            <h3
              className={`block px-6 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--m-slate-3)] ${
                gi > 0 && today.length > 0 ? 'pt-3' : 'pt-2'
              }`}
            >
              {group.label}
            </h3>
            <ul className={`sn-notice-card ${cardMargin} rounded-tile bg-[var(--m-paper)]`}>
              {group.rows.map((n) => (
                <NotificationItem key={n.notification_id} item={n} returnTo={returnTo} onRead={onRead} now={now} />
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

/**
 * The notices whose BODY is the Setnayan team's own typed note (the admin's answer to a removal request, sent as-is)
 * — the only words `brandWords` respells. A title carries names (an event's, a guest's) and is never touched.
 */
const TEAM_TYPED_BODY: ReadonlySet<NotificationRow['type']> = new Set(['event_deletion_answered']);

/** How far a swipe opens: the one quiet "Mark read" behind the row. */
const REVEAL = 96;

function NotificationItem({
  item: n,
  returnTo,
  onRead,
  now,
}: {
  item: NotificationRow;
  returnTo: string;
  onRead?: (notificationId: string) => void;
  now: Date;
}) {
  const unread = !n.read_at;
  const label = notificationShortLabel(n.type);
  const Icon = ICONS[notificationIcon(n.type)];

  // ── the phone's swipe ──
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null);
  const swiped = useRef(false);

  // ── the desktop ⋯ ──
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [menu]);

  const open = shift <= -REVEAL / 2;

  return (
    <li
      className="group relative first:rounded-t-tile last:rounded-b-tile"
      data-notice=""
      data-unread={unread ? '' : undefined}
    >
      <div className="relative overflow-hidden rounded-[inherit]">
        {unread ? (
          <form action={markNotificationRead} onSubmit={() => onRead?.(n.notification_id)} className="absolute inset-y-0 right-0 flex">
            <input type="hidden" name="notification_id" value={n.notification_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button
              type="submit"
              tabIndex={open ? 0 : -1}
              data-notice-swipe-mark=""
              className="flex h-full min-h-11 w-24 items-center justify-center bg-[var(--m-ivory)] text-[13px] font-semibold text-[var(--m-nav-active)]"
            >
              Mark read
            </button>
          </form>
        ) : null}

        <div
          className="relative z-[1] flex items-center bg-[var(--m-paper)] group-hover:bg-[var(--m-paper-2)]"
          style={{
            transform: shift ? `translateX(${shift}px)` : undefined,
            transition: dragging ? 'none' : 'transform 0.2s ease',
            touchAction: 'pan-y',
          }}
          onTouchStart={(e) => {
            if (!unread) return;
            const t = e.touches[0];
            if (!t) return;
            drag.current = { x: t.clientX, y: t.clientY, base: shift, axis: null };
            swiped.current = false;
          }}
          onTouchMove={(e) => {
            const d = drag.current;
            const t = e.touches[0];
            if (!d || !t) return;
            const dx = t.clientX - d.x;
            const dy = t.clientY - d.y;
            if (!d.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (d.axis !== 'x') return;
            swiped.current = true;
            setDragging(true);
            setShift(Math.max(-REVEAL, Math.min(0, d.base + dx)));
          }}
          onTouchEnd={() => {
            const d = drag.current;
            drag.current = null;
            setDragging(false);
            if (d?.axis === 'x') setShift((s) => (s <= -REVEAL / 2 ? -REVEAL : 0));
          }}
        >
          <form
            action={markNotificationRead}
            onSubmit={() => onRead?.(n.notification_id)}
            className="min-w-0 flex-1"
          >
            <input type="hidden" name="notification_id" value={n.notification_id} />
            <input type="hidden" name="return_to" value={n.related_url ?? returnTo} />
            <RowButton
              onClickCapture={(e) => {
                // A swipe is not a press, and a press on an opened row closes it.
                if (swiped.current) {
                  e.preventDefault();
                  swiped.current = false;
                } else if (shift !== 0) {
                  e.preventDefault();
                  setShift(0);
                }
              }}
            >
              <span
                role="img"
                aria-label={label}
                className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--m-ivory)] text-ink"
                data-notice-icon=""
              >
                <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1" data-notice-message="">
                <span
                  className={`line-clamp-2 text-[15px] leading-[1.2] ${
                    unread ? 'font-semibold text-ink' : 'font-medium text-[var(--m-slate-2)]'
                  }`}
                >
                  {n.title}
                </span>
                {n.body ? (
                  <span
                    className={`mt-0.5 block truncate text-[13px] ${
                      unread ? 'text-[var(--m-slate-2)]' : 'text-[var(--m-slate-3)]'
                    }`}
                  >
                    {TEAM_TYPED_BODY.has(n.type) ? brandWords(n.body) : n.body}
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-[28px] flex-none flex-col items-end gap-1.5">
                <span className="text-[12px] leading-none text-[var(--m-slate-3)]" suppressHydrationWarning>
                  {relativeTimeShort(n.created_at, now)}
                </span>
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full bg-[var(--m-nav-active)] ${unread ? '' : 'invisible'}`}
                  data-notice-dot=""
                />
                {unread ? <span className="sr-only">Unread</span> : null}
              </span>
            </RowButton>
          </form>

          {unread ? (
            <button
              type="button"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className={`-my-1 ml-0.5 mr-1.5 hidden h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--m-slate-3)] hover:text-ink ${
                menu ? 'lg:inline-flex' : 'lg:group-focus-within:inline-flex lg:group-hover:inline-flex'
              }`}
              data-notice-more=""
            >
              <MoreHorizontal aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-3.5 top-[52px] z-[3] min-w-[160px] rounded-xl border border-ink/10 bg-[var(--m-paper)] p-1.5 shadow-lg" // no-card-ok: a dropdown menu's own surface (the approved drawing), not a content card
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setMenu(false);
            }
          }}
        >
          <form action={markNotificationRead} onSubmit={() => onRead?.(n.notification_id)}>
            <input type="hidden" name="notification_id" value={n.notification_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-ink hover:bg-[var(--m-paper-2)]"
            >
              <CheckCheck aria-hidden className="h-4 w-4 text-[var(--m-slate-2)]" strokeWidth={1.75} />
              Mark read
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

/** The row itself — the form's one submit button. Dims while the press is on its way. */
function RowButton({
  children,
  onClickCapture,
}: {
  children: ReactNode;
  onClickCapture: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending || undefined}
      onClickCapture={onClickCapture}
      className={`flex min-h-[62px] w-full items-center gap-3 py-[9px] pl-3 pr-3.5 text-left ${pending ? 'opacity-60' : ''}`}
      data-notice-row=""
    >
      {children}
    </button>
  );
}

/**
 * The heading row the pop-over and both pages share: "Notifications" and, while anything is unread, the quiet gold
 * "Mark all read" text button (it replaces the bordered button-secondary, owner 2026-10-25).
 */
export function NotificationsHead({
  unreadCount,
  returnTo,
  level,
  onMarkAll,
}: {
  unreadCount: number;
  returnTo: string;
  /** The page carries the h1; the pop-over an h2. */
  level: 'page' | 'popover';
  onMarkAll?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between ${level === 'page' ? 'px-4 pb-2 pt-1' : 'px-4 pb-1.5 pt-3.5'}`}
      data-notifications-head=""
    >
      {/* Literal tags, not a dynamic `<Heading>`: the-skeleton-promises-only-what-the-page-draws reads `<h1` to know the page draws its title. */}
      {level === 'page' ? (
        <h1 className="text-[22px] font-semibold text-ink">Notifications</h1>
      ) : (
        <h2 className="text-[17px] font-semibold text-ink">Notifications</h2>
      )}
      {unreadCount > 0 ? (
        <form action={markAllNotificationsRead} onSubmit={onMarkAll}>
          <input type="hidden" name="return_to" value={returnTo} />
          <SubmitButton
            overlay={false}
            pendingLabel="Marking…"
            className="-mr-1.5 inline-flex h-11 items-center rounded-lg px-1.5 text-[13px] font-semibold text-[var(--m-nav-active)] hover:bg-ink/5"
            data-mark-all-read=""
          >
            Mark all read
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
