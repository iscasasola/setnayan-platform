import { CheckCheck } from 'lucide-react';
import { markAllNotificationsRead } from '@/lib/notification-actions';
import type { NotificationRow } from '@/lib/notifications';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import { SupplierSubmit } from '../_components/supplier-submit';
import { DatesRow } from '../customers/_components/dates-row';

/**
 * NOTIFICATIONS › RECENT — the screen (simpler supplier dashboard step 6; prototype SCREENS.notifs): the shipped
 * `NotificationsList` and `markAllNotificationsRead` under one "Recent" line. Presentational; the page and
 * `/dev/supplier-plan-lab` both mount it.
 */
export function NotificationsView({ items, returnTo }: { items: NotificationRow[]; returnTo: string }) {
  const unreadCount = items.filter((n) => !n.read_at).length;
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
