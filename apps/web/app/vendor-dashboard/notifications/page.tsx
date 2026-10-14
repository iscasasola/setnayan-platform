import { redirect } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnNotifications } from '@/lib/notifications';
import { markAllNotificationsRead } from '@/lib/notification-actions';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import { SupplierSubmit } from '../_components/supplier-submit';
import { DatesRow } from '../customers/_components/dates-row';

export const metadata = { title: 'Notifications · Supplier' };

/**
 * /vendor-dashboard/notifications — Settings › Notifications › RECENT (simpler supplier dashboard step 6; prototype
 * SCREENS.notifs). The shipped list (`NotificationsList`) and the shipped `markAllNotificationsRead`, under one
 * "Recent" line — including "Someone else was booked" (`inquiry_displaced`, DECISION_LOG 2026-10-10), whose label now
 * says it in those words. The push switch moved to Settings › Notifications, beside how email reaches you; one row here
 * points there. Reached from the bell, Settings and More's Settings.
 */
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
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-supplier-notifications="">
      <h1 className="sn-h1">Notifications</h1>

      <div className="mt-3 flex min-h-11 items-center gap-3" data-notifications-eyebrow="">
        <span className="home-k2 min-w-0 flex-1">Recent</span>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <input type="hidden" name="return_to" value={returnTo} />
            <SupplierSubmit
              tone="neutral"
              icon={<CheckCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              label="Mark all read"
              pendingLabel="Marking…"
            />
          </form>
        ) : null}
      </div>

      <NotificationsList
        items={items}
        returnTo={returnTo}
        emptyState={{
          title: 'Nothing yet.',
          body: <>When a couple writes, books or pays — or someone else is booked on a date you were asked for — it shows here.</>,
        }}
      />

      <div className="mt-4 border-t border-ink/10">
        <DatesRow data="notifications-settings" title="Push and email" line="How we reach you · Settings" href="/vendor-dashboard/settings" />
      </div>
    </div>
  );
}
