import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnNotifications } from '@/lib/notifications';
import { markAllNotificationsRead } from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';

export const metadata = { title: 'Notifications' };

export default async function CoupleNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await fetchOwnNotifications(supabase, user.id);
  const unreadCount = items.filter((n) => !n.read_at).length;
  const returnTo = '/dashboard/notifications';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Notifications</h1>
          <p className="max-w-prose text-base text-ink/65">
            New messages, order quotes, and payment confirmations land here.
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
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
      </header>

      <NotificationsList
        items={items}
        returnTo={returnTo}
        emptyState={{
          title: 'No notifications yet.',
          body: (
            <>
              You&rsquo;ll see notifications when a vendor replies to a thread, when the
              Setnayan team confirms an order quote, or when a payment is matched. While
              you&rsquo;re here — head to the dashboard and add a vendor or start a thread to
              kick things off.
            </>
          ),
          footer: (
            <Link href="/dashboard" className="button-secondary">
              Back to events
            </Link>
          ),
        }}
      />
    </div>
  );
}
