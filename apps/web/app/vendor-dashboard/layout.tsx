import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { countUnread } from '@/lib/notifications';
import { fetchUserRoleSummary } from '@/lib/roles';
import { fetchUserEvents, sortEventsForSwitcher } from '@/lib/events';
import { logQueryError } from '@/lib/supabase/error-detect';
import { EventSwitcher } from '@/app/dashboard/[eventId]/_components/event-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { VendorSidebar } from './_components/vendor-sidebar';
import { VendorBottomNav } from './_components/vendor-bottom-nav';
import { resolveVendorRole } from '@/lib/vendor-role';

/**
 * Vendor dashboard layout — v2.1 Navigation Phase 2 (vendor doorway).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit + Nav Phase 3 (admin · PR #606)
 * + Nav Phase 1 (customer · PR #625) pattern. Replaces the prior
 * 14-tab horizontal pill bar (apps/web/app/vendor-dashboard/_components/
 * subnav-tab.tsx) with the shared SidebarShell + SidebarSection +
 * SidebarItem primitives from PR #603. Mobile chrome moves to
 * VendorBottomNav with /vendor-dashboard/more as the overflow landing.
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). topBar slot carries the vendor
 * utilities cluster (brand logo · role-switch pill · live unread bell ·
 * display name · sign-out). Mobile chrome (VendorBottomNav at bottom)
 * is rendered as a sibling of SidebarShell — both auto-hide / show via
 * their own breakpoint primitives (sidebar lg:flex, bottom-nav lg:hidden).
 *
 * RETIRED from the previous layout shape:
 *   - 14-tab horizontal pill bar at <nav aria-label="Vendor sections">
 *     with 14 VendorSubnavTab instances + overflow-x-auto scroll. The
 *     pill bar provided no per-route grouping (Bookings + Services +
 *     Attributes read as siblings of Tax docs + Notifications even
 *     though they sit in different cognitive buckets). The new sidebar
 *     buckets surfaces into 6 groups (Home · Pipeline · Communicate ·
 *     Marketing · Money · Team).
 *   - Notifications-tab badge wiring via liveNotificationsUserId on the
 *     SubnavTab. Replaced with topbar UnreadBellBadge per the Nav Phase 1
 *     (customer · PR #625) pattern — bell sits in the utilities cluster
 *     and lives via Supabase Realtime. Single source of truth for unread.
 *   - VendorSubnavTab component itself. The file is retired in this PR.
 *     The shared SidebarItem primitive handles the same job (active
 *     state + label + icon + badge) for the desktop tree, and the
 *     UnreadBellBadge handles the live-unread case it specialized in.
 *
 * AUTHORIZATION + DATA FETCHING preserved verbatim from the prior layout
 * — see the canonical vendor-access gate comment block + the
 * hasVendorAccess fetcher pattern below. Nav Phase 2 is purely a chrome
 * refactor; no server-side semantics changed.
 *
 * NOTIFICATIONS — UnreadBellBadge in topbar handles the live unread
 * count + click-through to /vendor-dashboard/notifications. The
 * Notifications surface is NOT given a sidebar entry on desktop because
 * the topbar bell IS the canonical entry point (matches admin chrome).
 * On mobile chrome the /more landing surfaces /vendor-dashboard/
 * notifications via its activeMatch list, so the More tab lights up
 * when the vendor views the notifications page directly.
 */
export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard'));
  const supabase = await createClient();

  const [profileRes, unreadCount, roles, events, vendorRole] = await Promise.all([
    supabase
      .from('users')
      .select('account_type, email, display_name, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    fetchUserRoleSummary(supabase, user.id),
    // Couple events for the top-left EventSwitcher (owner directive
    // 2026-06-02: switcher visible on all 3 dashboards, same top-left spot
    // as the customer doorway). Defensive .catch() so a throw in this
    // non-critical chrome fetch can't crash the vendor layout — degrade to
    // the empty "+" monogram. Mirrors DashboardLayout's 5th-hotfix pattern.
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'VendorDashboardLayout (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    // Vendor team role for the role-aware nav shell (owner/admin = full nav,
    // agent/viewer = scoped). Resolved here so both the sidebar + bottom-nav
    // render from one source. Independent of the others → safe in Promise.all.
    resolveVendorRole(supabase, user.id),
  ]);
  const profile = profileRes.data;

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Login-driven ghosting check (no cron) — after the response, once per login
  // (gated inside the helper). Vendor side: nudge if inquiries they received
  // sit unanswered past the threshold. No-op for a user with no vendor profile.
  after(() => runLoginGhostingCheck(user.id, 'vendor'));

  // Vendor-access gate — canonical "do they have vendor access" rule lives in
  // `fetchUserRoleSummary` (apps/web/lib/roles.ts:165-167): a user has access
  // if they own a `vendor_profiles` row OR sit on any `vendor_team_members`
  // row, regardless of `users.account_type`. This matches the rule the
  // unified switcher uses to decide whether to offer the "Shop console"
  // target (apps/web/app/dashboard/[eventId]/_components/event-switcher.tsx
  // roleTargets builder — formerly the RoleSwitchPill, retired 2026-06-12).
  //
  // Before this 2026-05-29 fix the layout instead checked the rigid
  // `profile?.account_type === 'vendor'` predicate, which bounced anyone
  // whose primary account_type wasn't 'vendor' back to /dashboard — even
  // when they legitimately owned a vendor_profile (e.g. the owner running
  // §10a Internal Account with is_internal=TRUE who also owns a vendor
  // profile for pilot dogfooding). The role pill would offer Shop console,
  // the user would click it, and the layout would silently redirect them
  // back to the customer dashboard. Per CLAUDE.md 2026-05-15 dual-role lock
  // ("a single users row may carry account_type='vendor' AND own/host
  // events as a customer · Vendor application is additive") + 2026-05-20
  // Login-landing rule lock ("admin + vendor consoles reached via
  // role-switch pill only"), the canonical access gate is the role pill,
  // and any console layout must accept users the pill grants access to.
  if (!roles.hasVendorAccess) {
    redirect('/dashboard');
  }

  const displayName = profile?.display_name ?? profile?.email ?? 'Vendor';

  // EventSwitcher data — same shape DashboardLayout feeds OuterDashboardHeader.
  // Hide archived events; active-first + expired-rightmost; primary (or first
  // active) is the anchor monogram. Zero events → the wrapper renders the
  // empty "+" monogram linking to /dashboard/create-event.
  const visibleEvents = events.filter((e) => !e.archived);
  const activeEvents = sortEventsForSwitcher(visibleEvents);
  const primaryEvent = visibleEvents.find((e) => e.is_primary) ?? activeEvents[0] ?? null;
  const switcherEvents = activeEvents.map((e) => ({
    event_id: e.event_id,
    display_name: e.display_name,
    event_date: e.event_date,
    is_primary: e.is_primary,
    monogram_text: e.monogram_text,
    monogram_color: e.monogram_color,
    // Carry the onboarding free-monogram design (owner-locked 2026-06-03) so the
    // switcher's anchor + dropdown rows render the couple's REAL customized
    // monogram, matching the customer doorway (the basic-badge bug otherwise).
    monogram_frame_key: e.monogram_frame_key,
    monogram_font_key: e.monogram_font_key,
  }));

  // Top bar — vendor utilities cluster: unified switcher, live unread bell,
  // display name, sign-out form. The RoleSwitchPill (mobile topBar + desktop
  // sidebar footer) is RETIRED 2026-06-12 per owner directive "single
  // switcher" — the unified EventSwitcher top-left now owns BOTH event
  // switching and cross-console hopping (Customer view / Setnayan HQ) on
  // every viewport.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {/* Top-left unified switcher — same top-left corner it holds on the
          customer doorway (owner directive 2026-06-02). Customer chrome
          carries no brand wordmark in this corner either (2026-05-15 chrome
          lock), so all three doorways read consistently. Zero couple events →
          the switcher renders the empty "+" monogram anchor but the menu
          (incl. the "Switch view" rows) still opens via the caret. */}
      <EventSwitcher
        currentRole="vendor"
        currentEventId={primaryEvent?.event_id ?? null}
        currentEventName={primaryEvent?.display_name ?? null}
        currentEventDate={primaryEvent?.event_date ?? null}
        currentMonogramText={primaryEvent?.monogram_text ?? null}
        currentMonogramColor={primaryEvent?.monogram_color ?? null}
        currentMonogramFrameKey={primaryEvent?.monogram_frame_key}
        currentMonogramFontKey={primaryEvent?.monogram_font_key}
        events={switcherEvents}
        hasCustomerAccess={roles.hasCustomerAccess}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
      />
      <div className="flex items-center gap-2">
        {/* Live unread bell — replaces the SubnavTab liveNotificationsUserId
            wiring from the pre-Phase 2 layout. Single canonical surface
            for unread count + click-through to /vendor-dashboard/
            notifications. Matches the customer doorway pattern shipped
            via Nav Phase 1 (PR #625). */}
        <UnreadBellBadge
          userId={user.id}
          initialUnread={unreadCount}
          href="/vendor-dashboard/notifications"
          ariaBaseLabel="Notifications"
          ariaUnreadSuffix="unread"
        />
        <span className="hidden text-sm text-ink/70 sm:inline">{displayName}</span>
        <form action="/auth/sign-out" method="post">
          <button className="button-secondary h-9 px-3 text-xs" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    // app-surface → Source Sans backend typeface (globals.css). Plain block
    // wrapper: no transform/filter so the BottomNav's fixed positioning and
    // SidebarShell's own offset math are unaffected.
    <div className="app-surface">
      <SidebarShell sidebar={<VendorSidebar role={vendorRole} />} topBar={topBar}>
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <VendorBottomNav role={vendorRole} />
    </div>
  );
}
