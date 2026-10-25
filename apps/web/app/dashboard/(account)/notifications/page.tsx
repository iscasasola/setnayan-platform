import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnNotifications } from '@/lib/notifications';
import { NotificationsHead, NotificationsList } from '@/app/_components/notifications/notifications-list';

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
    /*
      "VIEW ALL" — THE SAME ROWS AS THE BELL'S POP-OVER (owner 2026-10-25: "view all notifications simpler"). A visible
      "Notifications" title with the quiet "Mark all read" beside it; no cards, no type pills, no per-row buttons.
    */
    <div className="mx-auto w-full max-w-3xl pb-10 pt-4 lg:pt-7" data-notifications-page="">
      <NotificationsHead unreadCount={unreadCount} returnTo={returnTo} level="page" />

      <NotificationsList
        items={items}
        returnTo={returnTo}
        emptyState={{
          title: 'No notifications yet.',
          body: (
            <>
              You&rsquo;ll see notifications when a supplier replies to a thread, when the
              Setnayan team confirms an order quote, or when a payment is matched. While
              you&rsquo;re here — head to the dashboard and add a supplier or start a thread to
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
