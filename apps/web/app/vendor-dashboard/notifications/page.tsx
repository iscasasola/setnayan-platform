import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchOwnNotifications,
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  relativeTime,
} from '@/lib/notifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Notifications · Vendor' };

export default async function VendorNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await fetchOwnNotifications(supabase, user.id);
  const unreadCount = items.filter((n) => !n.read_at).length;
  const returnTo = '/vendor-dashboard/notifications';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Notifications</h1>
          <p className="text-base text-ink/65">
            Live in-app feed. Email delivery ships once Resend SMTP is wired.
          </p>
        </div>
      </header>

      {unreadCount > 0 ? (
        <form action={markAllNotificationsRead} className="mb-4">
          <input type="hidden" name="return_to" value={returnTo} />
          <SubmitButton
            className="button-secondary inline-flex items-center gap-2"
            pendingLabel="Marking…"
          >
            <CheckCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Mark all read
          </SubmitButton>
        </form>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <Bell aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No notifications yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            You&rsquo;ll be notified here when a couple sends a new message. Make sure
            your{' '}
            <Link href="/vendor-dashboard" className="text-terracotta hover:underline">
              contact email
            </Link>{' '}
            is filled in — that&rsquo;s how couples find you and start a conversation.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const unread = !n.read_at;
            return (
              <li
                key={n.notification_id}
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
          })}
        </ul>
      )}
    </div>
  );
}
