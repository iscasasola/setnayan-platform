import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLifecyclePhase } from '@/lib/day-of-mode';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import { countUnreadMessages } from '@/lib/chat';
import { getLocale, makeT } from '@/lib/i18n';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { UnreadMessagesBadge } from '@/app/_components/unread-messages-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { CustomerSidebar } from './_components/customer-sidebar';
import { CustomerBottomNav } from './_components/customer-bottom-nav';
import { CustomerNavFab } from './_components/customer-nav-fab';
import { CustomerSectionSubnav } from './_components/customer-section-subnav';
import { getNavSlotMap } from '@/lib/nav-registry';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

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
  // getDashboardShell fetches events + roles + unreadCount via React cache() —
  // the cache key is userId only, so if (account)/layout or any other layout
  // in this render tree already resolved it, this call is free (zero DB hits).
  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    photoUrl: null,
    events: [],
    gallery: [],
    favorites: [],
    editorials: [],
    context: { hasVendor: false, vendorName: null, isAdmin: false },
  };
  const [
    { unreadCount },
    eventRes,
    unreadMessages,
    locale,
    switcherData,
  ] = await Promise.all([
    getDashboardShell(user.id),
    (async () => {
      try {
        const fullSelect =
          'event_id, public_id, display_name, event_date, archived, event_type, monogram_text, monogram_color, monogram_frame_key, monogram_font_key, monogram_style, monogram_custom_svg, monogram_uploaded_svg, cleared_at';
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
    // AccountSwitcher panel data. getSwitcherData never returns null after the
    // 2026-06-17 always-on fix; the .catch here guards against any outer throw.
    getSwitcherData(user.id).catch((err: unknown) => {
      console.error('[AccountSwitcher] data fetch failed:', err);
      return minimalSwitcherFallback;
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

  // Event Lifecycle Menu (2026-06-16): the bottom-nav roster swaps by lifecycle
  // phase (Plan → Day-of → After). Computed SERVER-SIDE so there's no client
  // Date.now() / hydration flash. `getLifecyclePhase` uses isEventDayActive
  // (live ‖ post) so an EVENING reception — which lands in `post` — still gets
  // the Day-of bar, and the `cleared_at` close-out (PR3) flips it to `after`.
  // (The `after` roster lands in PR4; until then `after` shows the Plan bar.)
  const phase = getLifecyclePhase(
    event.event_date as string | null,
    (event as { cleared_at?: string | null }).cleared_at ?? null,
  );

  const tr = makeT(locale);

  // Top bar lives inside SidebarShell's topBar slot. Carries the event-
  // scoped utilities cluster — EventSwitcher (left), Marketplace + role-
  // switch + unread bell + profile menu (right). Pre-Phase 1 this sat
  // inside a <div className="sticky top-0 z-20 backdrop-blur"> wrapper
  // owned by the layout; now SidebarShell owns the sticky chrome and we
  // just inject the inner row.
  const topBar = (
    <div className="mx-auto flex w-full items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
      {/* Planning escape (Event Lifecycle Menu) — day-of only, mobile only.
          Desktop uses the sidebar; bottom nav is the day-of command center. */}
      {phase === 'dayof' ? (
        <Link
          href={`/dashboard/${eventId}/more`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream/80 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream hover:text-ink lg:hidden"
        >
          <ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Planning
        </Link>
      ) : null}
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
      {/* AccountSwitcher — mobile only, rightmost corner of the top bar.
          Desktop uses AccountSwitcherStandalone at the top of the sidebar. */}
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
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

  // Nav registry: resolve the admin-managed name+icon overrides server-side and
  // hand the slot map to the (client) bottom nav. Cached via NAV_REGISTRY_TAG.
  const navSlots = await getNavSlotMap();

  return (
    <>
      <SidebarShell
        sidebarHeader={<DoorwaySidebarHeader label="Planning" switcherData={switcherData} />}
        sidebar={
          <CustomerSidebar
            eventId={eventId}
            navSlots={navSlots}
            eventDate={(event.event_date as string | null) ?? null}
          />
        }
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math.
            `data-shell-main` is the hook globals.css uses to add EXTRA bottom
            room on routes where <CustomerSectionSubnav> docks a second floating
            pill above the bottom nav (see globals.css `html.subnav-docked`). */}
        <div data-shell-main className="pb-20 lg:pb-0">
          {/* Inner content wrapper is a <div>, not a <main>: SidebarShell
              already renders the single <main> landmark around its children
              (see sidebar-shell.tsx). Nesting a second <main> here produced
              two <main> elements in one tree — invalid HTML / duplicate
              landmark. */}
          <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <CustomerBottomNav eventId={eventId} phase={phase} navSlots={navSlots} />
      {/* NAV-2 broken-out primary action (the Shazam satellite) — a SIBLING of
          the locked BottomNav pill, never a 7th tab. Floats above the pill's
          right end, hides when the docked SubNav is up + in the After phase. */}
      <CustomerNavFab eventId={eventId} phase={phase} />
      {/* ONE docked section sub-nav for all 6 menus (owner 2026-06-17 "sub nav
          are child menus of the 6 menus"). Reads the canonical tree in
          lib/customer-menu.ts and renders whichever menu's CHILDREN belong to the
          current route — the Guests journey (Build·Invite·Confirm·Seat·Day-of,
          routed) and the Explore takeover (Summary·Shortlist·Build·Compare·Lock,
          in-page tabs) today; Studio/Design/Budget/Home children land in later
          PRs. Mounted here (a layout sibling of <CustomerBottomNav>, NOT inside
          any page) so it paints + responds the instant a section opens, ahead of
          the server-built panel, and the bottom nav collapses to icons-only while
          it's docked. Self-gates to null outside any menu's section. eventDate
          drives the Guests Day-of time-gate. */}
      <CustomerSectionSubnav eventId={eventId} eventDate={(event.event_date as string | null) ?? null} navSlots={navSlots} phase={phase} />
    </>
  );
}
