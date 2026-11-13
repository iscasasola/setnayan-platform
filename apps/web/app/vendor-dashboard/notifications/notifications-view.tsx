import type { NotificationRow } from '@/lib/notifications';
import type { NotificationPlaceFacts } from '@/lib/notification-place';
import { NotificationsHead, NotificationsList } from '@/app/_components/notifications/notifications-list';
import { DatesRow } from '../customers/_components/dates-row';

/**
 * NOTIFICATIONS › RECENT — the screen (simpler supplier dashboard step 6; prototype SCREENS.notifs): the shipped
 * `NotificationsList` and `markAllNotificationsRead`. Presentational; the page and `/dev/supplier-plan-lab` both mount it.
 *
 * Since 2026-10-25 it is the bell's "View all" (owner: "view all notifications simpler"): the SAME head and rows as the
 * pop-over — the visible "Notifications" title with the quiet "Mark all read" beside it. The "Recent" line left: the
 * rows now carry their own Today / Earlier.
 */
export function NotificationsView({
  items,
  returnTo,
  places = null,
}: {
  items: NotificationRow[];
  returnTo: string;
  /** Each row's place (`lib/notification-place.ts`); absent → the rows that need it say "Place didn't load". */
  places?: NotificationPlaceFacts | null;
}) {
  const unreadCount = items.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto w-full max-w-xl pb-16 pt-4 sm:pt-7" data-supplier-notifications="">
      <NotificationsHead unreadCount={unreadCount} returnTo={returnTo} level="page" />

      <NotificationsList
        items={items}
        places={places}
        returnTo={returnTo}
        emptyState={{
          title: 'Nothing yet.',
          body: <>When a couple writes, books or pays — or someone else is booked on a date you were asked for — it shows here.</>,
        }}
      />

      <div className="mx-4 mt-4 border-t border-ink/10">
        <DatesRow data="notifications-settings" title="Push and email" line="How we reach you · Settings" href="/vendor-dashboard/settings" />
      </div>
    </div>
  );
}
