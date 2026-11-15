import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnNotifications } from '@/lib/notifications';
import { fetchNotificationEventPlaces } from '@/lib/notification-places';
import { placeWhoFromSwitcher } from '@/lib/notification-place';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { NotificationsView } from './notifications-view';

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

  // 📍 Each row's PLACE: one batch for the rows' events, and the account menu's facts the layout already read.
  const [items, switcherData] = await Promise.all([fetchOwnNotifications(supabase, user.id), getSwitcherData(user.id)]);
  const events = await fetchNotificationEventPlaces(supabase, user.id, items);
  const returnTo = '/vendor-dashboard/notifications';

  return <NotificationsView items={items} places={{ events, who: placeWhoFromSwitcher(switcherData) }} returnTo={returnTo} />;
}
