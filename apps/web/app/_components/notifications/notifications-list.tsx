import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  relativeTime,
  type NotificationRow,
} from '@/lib/notifications';
import {
  markNotificationRead,
} from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * Shared notifications list + item + empty-state.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A4). The
 * couple (`/dashboard/notifications`) and vendor (`/vendor-dashboard/
 * notifications`) pages both call the same user-scoped `fetchOwnNotifications`
 * and forked a byte-identical `<ul>` of items + a near-identical empty state.
 * This component owns that shared markup; each page keeps its own auth gate,
 * header, and mark-all-read control, and passes the already-fetched rows down
 * along with the per-role `returnTo` path and `emptyState` copy.
 *
 * No behavior or visual change — rendered output matches the prior per-page
 * markup byte-for-byte (same classes, copy, and order). Pure dedup. Style
 * modelled on `app/_components/chat-message-stream.tsx`.
 */

type EmptyState = {
  /** Lead line under the bell icon. */
  title: string;
  /** Body node — JSX so the couple/vendor variants can embed their own links. */
  body: React.ReactNode;
  /** Optional footer node (e.g. the couple's "Back to events" button). */
  footer?: React.ReactNode;
};

type Props = {
  /** Already-fetched, user-scoped notification rows (newest first). */
  items: NotificationRow[];
  /**
   * Path the mark-read server action redirects back to after flipping
   * `read_at`. Per-role: `/dashboard/notifications` or
   * `/vendor-dashboard/notifications`.
   */
  returnTo: string;
  /** Per-role empty-state copy shown when `items` is empty. */
  emptyState: EmptyState;
};

export function NotificationsList({ items, returnTo, emptyState }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
        <Bell aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">{emptyState.title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">{emptyState.body}</p>
        {emptyState.footer ? <div className="mt-4">{emptyState.footer}</div> : null}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((n) => (
        <NotificationItem key={n.notification_id} item={n} returnTo={returnTo} />
      ))}
    </ul>
  );
}

function NotificationItem({
  item: n,
  returnTo,
}: {
  item: NotificationRow;
  returnTo: string;
}) {
  const unread = !n.read_at;
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        unread ? 'border-terracotta/30 bg-terracotta/5' : 'border-ink/10 bg-cream'
      }`}
    >
      <span
        className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
          NOTIFICATION_TYPE_TONE[n.type]
        }`}
      >
        {NOTIFICATION_TYPE_LABEL[n.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{n.title}</p>
        {n.body ? <p className="text-sm text-ink/65">{n.body}</p> : null}
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
          {relativeTime(n.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {n.related_url ? (
          <Link
            href={n.related_url}
            className="rounded-md bg-mulberry px-3 py-1 text-xs font-medium text-cream hover:bg-mulberry-600"
          >
            Open
          </Link>
        ) : null}
        {unread ? (
          <form action={markNotificationRead}>
            <input type="hidden" name="notification_id" value={n.notification_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <SubmitButton
              className="w-full rounded-md bg-ink/5 px-3 py-1 text-xs text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-60"
              pendingLabel="…"
            >
              Mark read
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}
