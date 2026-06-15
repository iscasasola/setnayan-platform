import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { countUnread } from '@/lib/notifications';
import { countUnreadMessages } from '@/lib/chat';
import { getLocale, makeT } from '@/lib/i18n';
import { logQueryError } from '@/lib/supabase/error-detect';
import { EventSwitcher } from './_components/event-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { UnreadMessagesBadge } from '@/app/_components/unread-messages-badge';
import { ProfileMenu } from '@/app/_components/profile-menu';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { CustomerSidebar } from './_components/customer-sidebar';
import { CustomerBottomNav } from './_components/customer-bottom-nav';
import { getCreatableEventTypes } from '@/lib/event-types-db';

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
 *   - `lg:-ml-60` outer-cancellation hack (removed 2026-06-14 chrome
 *     retirement). The legacy cream OuterDashboardHeader + its `lg:pl-60`
 *     gutter moved OUT of the shared parent layout into the `(account)`
 *     route group, so the parent no longer renders any chrome or gutter on
 *     event routes — there is nothing left to cancel. SidebarShell handles
 *     the desktop offset internally via --shell-main-offset. This is what
 *     killed the "old cream chrome flashes, then the paper chrome takes
 *     over" effect on event-route navigations (the cream shell used to paint
 *     server-side and be suppressed only by a client usePathname() guard).
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
    // Delegate path (feature-access program Phase 2, 2026-06-12): an
    // accepted, non-removed event_moderators row admits the user — this is
    // the 0048 invite system finally going live. Data access is enforced
    // per-area by the moderator RLS policies (migration 20261129000000);
    // the layout only answers "may they see this event's shell at all".
    const { data: moderator, error: moderatorError } = await supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle();
    if (moderatorError) {
      logQueryError(
        'EventLayout (event_moderators)',
        moderatorError,
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
    }
    if (!moderator) {
      notFound();
    }
  }

  // 5th hotfix pass extension (2026-05-23 PM) — same defensive pattern
  // shipped at /dashboard/layout.tsx via PR #452, applied one level
  // deeper for event-scoped routes. Owner reported global-error STILL
  // firing after PR #452 deployed because the /dashboard root index
  // redirects to /dashboard/{primary.event_id} which goes through THIS
  // layout — not the parent /dashboard/layout.tsx that #452 hardened.
  // Each fetcher wrapped in .catch() with safe defaults so one throw
  // can't crash the whole layout tree.
  const [eventRes, unreadCount, unreadMessages, locale, switcherEvents, roles, profilePhotoUrl] = await Promise.all([
    (async () => {
      try {
        const fullSelect =
          'event_id, public_id, display_name, event_date, archived, event_type, monogram_text, monogram_color, monogram_frame_key, monogram_font_key, monogram_style';
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
    // Account profile photo for the (I) avatar (owner directive 2026-06-12:
    // the avatar is the ACCOUNT's photo, never the event logo — reverses the
    // 2026-06-03 avatar-IS-event-logo lock). Presigned display URL resolved
    // server-side; degrades to null (initial fallback) on any error.
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();
      return displayUrlForStoredAsset(data?.profile_photo_url);
    })().catch((err: unknown) => {
      logQueryError(
        'EventLayout (profile photo threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return null;
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
  // DB-driven creatable event types for the switcher's add-event sheet
  // (2026-06-13 cutover) — request-cached via React cache().
  const creatableEventTypes = await getCreatableEventTypes();

  const topBar = (
    <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <EventSwitcher
        currentRole="customer"
        currentEventId={event.event_id}
        currentEventName={event.display_name}
        currentEventDate={event.event_date}
        currentMonogramText={event.monogram_text}
        currentMonogramColor={event.monogram_color}
        currentMonogramFrameKey={event.monogram_frame_key}
        currentMonogramFontKey={event.monogram_font_key}
        currentMonogramStyle={event.monogram_style}
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
            monogram_style: e.monogram_style,
          }))}
        hasCustomerAccess={roles.hasCustomerAccess}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
        eventTypes={creatableEventTypes}
      />
      <div className="flex items-center gap-2">
        {/* Marketplace (Store) link + mobile Switch View pill REMOVED from
            the event-scoped top nav per owner directive 2026-06-03 (circled
            both icons on the mobile top strip; "remove these 2 on top nav").
            Neither function is orphaned:
            • Marketplace `/explore` stays reachable via the home
              marketplace-tease-strip CTA, the "Browse your matched services"
              button, and every plan-card folder link.
            • Role-switching (Shop / Setnayan HQ consoles) stays reachable via the
              unified EventSwitcher's "Switch view" rows (left monogram caret)
              on every viewport — the desktop sidebar-footer pill was retired
              2026-06-12 (single-switcher directive). */}
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
        {/* (I) avatar = the ACCOUNT's profile photo (or initial fallback) —
            owner directive 2026-06-12. The event's monogram/logo belongs to
            the event only and lives on the EventSwitcher chip at left. */}
        <ProfileMenu
          email={user.email ?? ''}
          photoUrl={profilePhotoUrl}
          ariaLabel={tr('common.profile')}
          eventId={eventId}
        />
      </div>
    </div>
  );

  // 2026-06-14 chrome retirement: the `lg:-ml-60` outer-cancel hack is GONE.
  // The parent `dashboard/layout.tsx` no longer renders the cream
  // OuterDashboardHeader or its `lg:pl-60` gutter (that chrome moved to the
  // `(account)` route group), so there is no parent padding left to cancel —
  // SidebarShell owns the desktop offset entirely via --shell-main-offset.
  // This is the structural half of removing the old-cream-flash on
  // event-route navigations.

  return (
    <>
      <SidebarShell
        sidebar={<CustomerSidebar eventId={eventId} />}
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
    </>
  );
}
