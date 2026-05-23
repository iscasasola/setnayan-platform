import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { getLocale, makeT } from '@/lib/i18n';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BottomNav } from './_components/bottom-nav';
import { EventSwitcher } from './_components/event-switcher';
import { SidebarResizeHandle } from './_components/sidebar-resize-handle';
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
  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Log silent RLS / network errors so the next "user can't reach their
  // own dashboard" mystery shows up in Sentry with the exact reason
  // instead of just landing on notFound(). The notFound() fallback
  // stays — better to 404 than crash — but logQueryError leaves a trail.
  if (membershipError) {
    logQueryError(
      'EventLayout (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }

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
      .maybeSingle(),
    countUnread(supabase, user.id),
    getLocale(),
    fetchUserEvents(supabase, user.id, 'couple'),
    fetchUserRoleSummary(supabase, user.id),
  ]);
  // Log silent SELECT errors before falling through to notFound().
  // Swapped from .single() (which sets PGRST116 "0 rows" as an error)
  // to .maybeSingle() (which returns null cleanly for the no-row case)
  // so a true row-missing surfaces as 404 and a real DB / column error
  // surfaces as a logged graceful-degrade → 404. The third hotfix pass
  // added this logging because the layout's .single() was previously
  // a silent crash surface when a future events ADD COLUMN migration
  // would land on code before SQL.
  if (eventRes.error) {
    logQueryError(
      'EventLayout (events)',
      eventRes.error,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
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

  // Owner directive 2026-05-23: "make sidebar resizable also." The
  // sidebar's width is now driven by the --sidebar-width CSS variable
  // (default 240px) instead of a hard-coded `lg:pl-60`. Both the
  // layout's body padding and the BottomNav sidebar width read the
  // same variable so they update in lockstep. The SidebarResizeHandle
  // client component (mounted at the bottom of this tree) owns the
  // variable + writes localStorage. See sidebar-resize-handle.tsx for
  // the full architectural rationale (CSS variable over context to
  // avoid forcing a client boundary across this server layout).
  return (
    // Outer container — body sits to the right of the sidebar on lg+
    // via `lg:pl-[var(--sidebar-width,240px)]`. This is Tailwind's
    // arbitrary-value syntax wrapping the CSS variable so the lg:
    // breakpoint gate still applies. Mobile (<lg) has no left padding
    // because the sidebar isn't rendered (BottomNav uses lg:flex);
    // body fills full width via its own px-4 / sm:px-6.
    // Owner directive 2026-05-23 ("issue again with home"): the OUTER
    // `dashboard/layout.tsx` server-applies `lg:pl-60` unconditionally
    // even though its OuterDashboardHeader returns null on event-scoped
    // routes (client-side `usePathname` check). That stacks 240px of
    // dead padding on top of THIS layout's own variable padding —
    // 480px total on lg+. `lg:-ml-60` cancels the outer's 240px so the
    // event-route body sits flush against the sidebar's right border
    // with only THIS layout's variable padding controlling the offset.
    // Non-event routes (admin, profile, notifications) are unaffected
    // because they don't render this inner layout.
    <div className="flex min-h-dvh flex-col bg-cream pb-16 lg:-ml-60 lg:pb-0 lg:pl-[var(--sidebar-width,240px)]">
      <div className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
        {/* Owner directive 2026-05-22: "why is it not maximizing the
            whole screen?" The previous cap (max-w-6xl / xl:max-w-7xl /
            2xl:max-w-screen-2xl) topped out at 1536px even on wide
            monitors, leaving significant whitespace on both sides on
            Macbook 16" and external displays. Removing the cap lets the
            event-scoped layout fill the full viewport with the existing
            horizontal padding (32px each side via lg:px-8). The header
            strip stays consistent with the main content below by
            mirroring the same width treatment. */}
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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

      {/* Full-width main — see comment above the header strip for the
          why (2026-05-22 owner directive). The event home's Finder-column
          layout + other event-scoped surfaces all benefit from filling
          the viewport on wide monitors. */}
      {/* Owner directive 2026-05-23: "there is a gap from side nav to body."
          On lg+ the sidebar already sits flush against the viewport edge
          with its own border-r — the main element doesn't need the 32px
          left padding the mobile + tablet layout uses. Drop to lg:pl-4
          (16px) so the body sits closer to the sidebar's right border. */}
      <main className="mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:pl-4 lg:pr-8">
        {children}
      </main>

      <BottomNav eventId={eventId} labels={navLabels} />

      {/* Owner directive 2026-05-23: resizable sidebar. Client component
          owns the --sidebar-width CSS variable + localStorage. Sits
          adjacent to BottomNav so both render at the document root
          level (no nested-tree constraints). Desktop-only — renders
          nothing on <lg viewports. */}
      <SidebarResizeHandle />
    </div>
  );
}
