import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { getLocale, makeT } from '@/lib/i18n';
import { BottomNav } from './_components/bottom-nav';
import { EventSwitcher } from './_components/event-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { ProfileMenu } from '@/app/_components/profile-menu';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';

type Props = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function EventLayout({ children, params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/dashboard/${eventId}`));
  const supabase = await createClient();

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
      .select(
        'event_id, public_id, display_name, event_date, archived, event_type, monogram_text, monogram_color',
      )
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
  // 4-tab BottomNav per CLAUDE.md 2026-05-22 (owner directive). Vendors + Budget
  // come out of the bottom (still reachable via planning cards on Home +
  // top-nav Marketplace + 14-tile NavGrid). Add-ons renames to Services.
  const navLabels = {
    home: tr('nav.home'),
    guests: tr('nav.guests'),
    website: tr('nav.website'),
    services: tr('nav.services'),
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream pb-16 lg:pb-0 lg:pl-60">
      <div className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <EventSwitcher
            currentEventId={event.event_id}
            currentEventName={event.display_name}
            currentEventDate={event.event_date}
            currentMonogramText={event.monogram_text}
            currentMonogramColor={event.monogram_color}
            events={switcherEvents
              .filter((e) => !e.archived)
              .map((e) => ({
                event_id: e.event_id,
                display_name: e.display_name,
                event_date: e.event_date,
                is_primary: e.is_primary,
                monogram_text: e.monogram_text,
                monogram_color: e.monogram_color,
              }))}
            hasVendorAccess={roles.hasVendorAccess}
            hasAdminAccess={roles.hasAdminAccess}
            vendorProfiles={roles.vendorProfiles}
          />
          <div className="flex items-center gap-2">
            <Link
              href="/vendors"
              aria-label="Vendor marketplace"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink sm:px-3"
            >
              <Store aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">Marketplace</span>
            </Link>
            <RoleSwitchPill
              currentRole="customer"
              hasCustomerAccess
              hasVendorAccess={roles.hasVendorAccess}
              hasAdminAccess={roles.hasAdminAccess}
              vendorProfiles={roles.vendorProfiles}
            />
            <UnreadBellBadge
              userId={user.id}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel={tr('nav.notifications')}
              ariaUnreadSuffix="unread"
            />
            <ProfileMenu
              email={user.email ?? ''}
              ariaLabel={tr('common.profile')}
            />
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
