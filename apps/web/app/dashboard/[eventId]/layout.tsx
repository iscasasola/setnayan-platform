import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { getLocale, makeT } from '@/lib/i18n';
import { BottomNav } from './_components/bottom-nav';
import { EventSwitcher } from './_components/event-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';

type Props = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function EventLayout({ children, params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Authorization (per acceptance criterion: 404 for non-couples).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  const [eventRes, unreadCount, locale, switcherEvents, roles] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, public_id, display_name, event_date, archived, event_type')
      .eq('event_id', eventId)
      .single(),
    countUnread(supabase, user.id),
    getLocale(),
    fetchUserEvents(supabase, user.id, 'couple'),
    fetchUserRoleSummary(supabase, user.id),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const tr = makeT(locale);
  const navLabels = {
    home: tr('nav.home'),
    guests: tr('nav.guests'),
    vendors: tr('nav.vendors'),
    budget: tr('nav.budget'),
    add_ons: tr('nav.add_ons'),
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream pb-16 lg:pb-0">
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <EventSwitcher
            currentEventId={event.event_id}
            currentEventName={event.display_name}
            currentEventDate={event.event_date}
            events={switcherEvents
              .filter((e) => !e.archived)
              .map((e) => ({
                event_id: e.event_id,
                display_name: e.display_name,
                event_date: e.event_date,
                is_primary: e.is_primary,
              }))}
            hasVendorAccess={roles.hasVendorAccess}
            hasAdminAccess={roles.hasAdminAccess}
            vendorProfiles={roles.vendorProfiles}
          />
          <div className="flex items-center gap-2">
            <UnreadBellBadge
              userId={user.id}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel={tr('nav.notifications')}
              ariaUnreadSuffix="unread"
            />
            <Link
              href="/dashboard/profile"
              aria-label={tr('common.profile')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-sm font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
            >
              {user.email?.charAt(0).toUpperCase() ?? '?'}
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <BottomNav eventId={eventId} labels={navLabels} />
    </div>
  );
}
