import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnNotifications } from '@/lib/notifications';
import { markAllNotificationsRead } from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';

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

      <NotificationsList
        items={items}
        returnTo={returnTo}
        emptyState={{
          title: 'No notifications yet.',
          body: (
            <>
              You&rsquo;ll be notified here when a couple sends a new message. Make sure
              your{' '}
              <Link href="/vendor-dashboard" className="text-terracotta hover:underline">
                contact email
              </Link>{' '}
              is filled in — that&rsquo;s how couples find you and start a conversation.
            </>
          ),
        }}
      />
    </div>
  );
}
