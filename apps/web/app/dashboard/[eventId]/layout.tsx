import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { countUnreadMessages } from '@/lib/chat';
import { getLocale, makeT } from '@/lib/i18n';
import { logQueryError } from '@/lib/supabase/error-detect';
import { EventSwitcher } from './_components/event-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { UnreadMessagesBadge } from '@/app/_components/unread-messages-badge';
import { ProfileMenu } from '@/app/_components/profile-menu';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { CustomerSidebar } from './_components/customer-sidebar';
import { CustomerBottomNav } from './_components/customer-bottom-nav';

type Props = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

/**
 * Event-scoped customer layout — v2.1 Navigation Phase 1 (customer doorway).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit + 2026-05-23 row 2 admin pattern
 * (PR #606 admin doorway shipped the SidebarShell + SidebarSection +
 * SidebarItem + BottomNav primitives). Phase 1 retires the legacy 5-tab
 * pill bar at apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx
 * (the file stays on disk for historical context only — no longer imported
 * here) and adopts the shared primitives for both desktop sidebar + mobile
 * BottomNav.
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). topBar slot carries the EventSwitcher
 * + utility cluster (Marketplace link · role-switch pill · unread bell ·
 * profile menu). Mobile chrome (CustomerBottomNav at bottom) is rendered
 * as a sibling of SidebarShell — both auto-hide / show via their own
 * breakpoint primitives (sidebar lg:flex, bottom-nav lg:hidden).
 *
 * RETIRED from the previous layout shape:
 *   - Per-instance sticky top strip rendered inline. SidebarShell now
 *     owns the sticky top-bar slot; we just inject the EventSwitcher +
 *     utilities into it.
 *   - <BottomNav> from ./_components/bottom-nav.tsx (legacy 5-tab pill +
 *     desktop sidebar variant). The new CustomerBottomNav uses the shared
 *     primitive and the new CustomerSidebar owns desktop nav structure.
 *   - <SidebarResizeHandle>. The legacy custom drag handle drove
 *     --sidebar-width on the document root for the legacy sidebar to
 *     consume. SidebarShell ships its own collapse/expand affordance
 *     (chevron in the sidebar footer + localStorage persistence under
 *     `setnayan.nav.sidebar.collapsed`). Resizable freeform width is
 *     deferred to a follow-up — the collapse toggle covers 95% of the
 *     "give me more reading room" use case.
 *   - `lg:-ml-60` outer-cancellation hack. The outer dashboard layout's
 *     OuterDashboardHeader returns null on event-scoped routes (the
 *     usePathname() check there does the right thing). With the legacy
 *     `lg:pl-60` removed from the outer layout (Phase 0 already replaced
 *     the outer chrome's hardcoded sidebar offset), no negative-margin
 *     cancellation is needed. The new SidebarShell handles desktop offset
 *     internally via --shell-main-offset.
 *
 * AUTHORIZATION + DATA FETCHING preserved verbatim from the prior layout
 * — see in-flow comments at the membership check + the 5th-hotfix Promise.
 * all defensive wrapping. Nav Phase 1 is purely a chrome refactor; no
 * server-side semantics changed.
 */
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

  // 5th hotfix pass extension (2026-05-23 PM) — same defensive pattern
  // shipped at /dashboard/layout.tsx via PR #452, applied one level
  // deeper for event-scoped routes. Owner reported global-error STILL
  // firing after PR #452 deployed because the /dashboard root index
  // redirects to /dashboard/{primary.event_id} which goes through THIS
  // layout — not the parent /dashboard/layout.tsx that #452 hardened.
  // Each fetcher wrapped in .catch() with safe defaults so one throw
  // can't crash the whole layout tree.
  const [eventRes, unreadCount, unreadMessages, locale, switcherEvents, roles] = await Promise.all([
    (async () => {
      try {
        const fullSelect =
          'event_id, public_id, display_name, event_date, archived, event_type, monogram_text, monogram_color, monogram_frame_key, monogram_font_key';
        const fullRes = await supabase
          .from('events')
          .select(fullSelect)
          .eq('event_id', eventId)
          .maybeSingle();
        if (
          fullRes.error &&
          /column .* does not exist|undefined_column|42703/i.test(
            (fullRes.error as { message?: string; code?: string }).message ??
              (fullRes.error as { code?: string }).code ??
              '',
          )
        ) {
          // Column missing on prod → migration drift. Fall back to *.
          return await supabase
            .from('events')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle();
        }
        return fullRes;
      } catch (caught) {
        logQueryError(
          'EventLayout (events SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null };
      }
    })(),
    countUnread(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'EventLayout (countUnread threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return 0;
    }),
    // Unread-message count for the Messages-icon badge. countUnreadMessages
    // already graceful-degrades to 0 internally (incl. when the read-marker
    // migration isn't pushed yet); the .catch here is the same belt-and-braces
    // wrapper every other chrome fetcher in this Promise.all carries.
    countUnreadMessages(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'EventLayout (countUnreadMessages threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return 0;
    }),
    Promise.resolve(getLocale()).catch(() => 'en' as const),
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'EventLayout (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'EventLayout (fetchUserRoleSummary threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return {
        hasCustomerAccess: true,
        hasVendorAccess: false,
        hasAdminAccess: false,
        vendorProfiles: [],
      } as Awaited<ReturnType<typeof fetchUserRoleSummary>>;
    }),
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

  // Top bar lives inside SidebarShell's topBar slot. Carries the event-
  // scoped utilities cluster — EventSwitcher (left), Marketplace + role-
  // switch + unread bell + profile menu (right). Pre-Phase 1 this sat
  // inside a <div className="sticky top-0 z-20 backdrop-blur"> wrapper
  // owned by the layout; now SidebarShell owns the sticky chrome and we
  // just inject the inner row.
  const topBar = (
    <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <EventSwitcher
        currentEventId={event.event_id}
        currentEventName={event.display_name}
        currentEventDate={event.event_date}
        currentMonogramText={event.monogram_text}
        currentMonogramColor={event.monogram_color}
        currentMonogramFrameKey={event.monogram_frame_key}
        currentMonogramFontKey={event.monogram_font_key}
        events={switcherEvents
          .filter((e) => !e.archived)
          .map((e) => ({
            event_id: e.event_id,
            display_name: e.display_name,
            event_date: e.event_date,
            is_primary: e.is_primary,
            monogram_text: e.monogram_text,
            monogram_color: e.monogram_color,
            monogram_frame_key: e.monogram_frame_key,
            monogram_font_key: e.monogram_font_key,
          }))}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
      />
      <div className="flex items-center gap-2">
        {/* Marketplace (Store) link + mobile Switch View pill REMOVED from
            the event-scoped top nav per owner directive 2026-06-03 (circled
            both icons on the mobile top strip; "remove these 2 on top nav").
            Neither function is orphaned:
            • Marketplace `/vendors` stays reachable via the home
              marketplace-tease-strip CTA, the "Browse your matched services"
              button, and every plan-card folder link.
            • Role-switching (Shop / Admin consoles) stays reachable via the
              EventSwitcher dropdown's "Switch view" rows (left monogram caret)
              on mobile, plus the desktop sidebar-footer pill (sidebarFooterPill
              below). */}
        {/* Messages icon + unread badge (iteration 0019; badge follow-up to
            the icon-only link from PR #837). Read-state lands via the
            chat_thread_reads marker (migration
            20260728000000_chat_thread_reads.sql) + count_unread_message_threads()
            RPC. countUnreadMessages graceful-degrades to 0 pre-migration, so
            the badge is safe before the owner pushes it. Styled to match
            UnreadBellBadge exactly. */}
        <UnreadMessagesBadge
          userId={user.id}
          initialUnread={unreadMessages}
          href={`/dashboard/${eventId}/messages`}
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
          monogram={{
            display_name: event.display_name,
            monogram_text: event.monogram_text,
            monogram_color: event.monogram_color,
            monogram_frame_key: event.monogram_frame_key,
            monogram_font_key: event.monogram_font_key,
          }}
          ariaLabel={tr('common.profile')}
        />
      </div>
    </div>
  );

  // Outer-cancel: the parent /dashboard/layout.tsx applies `lg:pl-60`
  // unconditionally even though OuterDashboardHeader (the consumer of
  // that 240px sidebar) returns null on event-scoped routes via its
  // usePathname() check. Without cancelling the parent's padding, the
  // SidebarShell sidebar would render PLUS 240px of dead left padding,
  // pushing the event-scoped main content 480px right of the viewport
  // edge on lg+. `lg:-ml-60` cancels the outer's 240px so the event-
  // route body sits flush against the SidebarShell sidebar's right
  // border with only SidebarShell's own --shell-main-offset controlling
  // the offset. Same pattern as the pre-Phase-1 layout's outer-cancel
  // hack (the cancel still needs to live here because the outer layout
  // is part of an unrelated chrome surface that other routes consume).
  // Switch View pill for the desktop sidebar footer slot — standardized
  // 2026-05-29 across all 3 doorways. The mobile-only duplicate inside
  // the topBar above (lg:hidden wrapper) handles <lg viewports where
  // SidebarShell's sidebar is hidden.
  const sidebarFooterPill = (
    <RoleSwitchPill
      currentRole="customer"
      hasCustomerAccess
      hasVendorAccess={roles.hasVendorAccess}
      hasAdminAccess={roles.hasAdminAccess}
      vendorProfiles={roles.vendorProfiles}
    />
  );

  return (
    <div className="lg:-ml-60">
      <SidebarShell
        sidebar={<CustomerSidebar eventId={eventId} />}
        sidebarFooter={sidebarFooterPill}
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">
          <main className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <CustomerBottomNav eventId={eventId} />
    </div>
  );
}
