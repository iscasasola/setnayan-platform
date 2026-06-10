import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';
import { DashboardEventSwitcher } from '@/app/_components/dashboard-event-switcher';
import { fetchUserRoleSummary } from '@/lib/roles';
import { fetchUserEvents, sortEventsForSwitcher } from '@/lib/events';
import { countUnread } from '@/lib/notifications';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminBottomNav } from './_components/admin-bottom-nav';

export const metadata = { title: 'Admin · Setnayan' };

/**
 * Admin layout — v2.1 Navigation Phase 3 (admin doorway).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin 28-surface lock + 2026-05-28 11th
 * + 14th rows + v2.1 brief canonical lock (10th 2026-05-28 row). Replaces
 * the prior horizontal pill bar (apps/web/app/admin/_components/admin-nav.tsx
 * 19-110) with the shared SidebarShell + SidebarSection + SidebarItem
 * primitives from PR #603. Mobile chrome moves to AdminBottomNav — a 4-tab
 * spine (Home · Work · Directory · More) with 3 overflow landing pages at
 * /admin/work + /admin/directory + /admin/more (legacy /admin/queues +
 * /admin/money redirect to /admin/work + /admin/more) — ops-shaped nav
 * redesign 2026-06-08.
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). topBar slot carries the admin utilities
 * cluster (brand logo · role-switch pill · admin badge · display name ·
 * sign-out). Mobile chrome (BottomNav at bottom) is rendered as a sibling
 * of SidebarShell — both auto-hide / show via their own breakpoint
 * primitives (sidebar lg:flex, bottom-nav lg:hidden).
 *
 * GuidedTour preserved unchanged — fires on first login per the existing
 * tour_seen_keys check.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin'));
  const supabase = await createClient();

  const [{ data: profile }, roles, events, unreadCount] = await Promise.all([
    supabase
      .from('users')
      .select(
        'display_name, email, account_type, is_internal, is_team_member, tour_seen_keys',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchUserRoleSummary(supabase, user.id),
    // Couple events for the top-left EventSwitcher (owner directive
    // 2026-06-02: switcher visible on all 3 dashboards, same top-left spot
    // as the customer doorway). Defensive .catch() so a throw in this
    // non-critical chrome fetch can't crash the admin layout — degrade to
    // the empty "+" monogram. Mirrors DashboardLayout's 5th-hotfix pattern.
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'AdminLayout (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    // Unread count for the top-bar bell. countUnread is React-cached + fails
    // soft to 0 internally, so no defensive wrapper is needed here.
    countUnread(supabase, user.id),
  ]);

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

  // Non-admins shouldn't even see the route exists — render a 404 instead of
  // bouncing to /dashboard, which could leak the existence of /admin.
  if (!isAdmin) notFound();

  const displayName = profile?.display_name ?? profile?.email ?? 'Admin';

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

  const badge = profile?.is_internal
    ? { label: '🟣 Internal', tone: 'bg-purple-100 text-purple-800' }
    : profile?.is_team_member
      ? { label: '🟢 Team Pool', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Admin', tone: 'bg-ink/10 text-ink/70' };

  // Switch View pill — lives in the desktop sidebar footer (added 2026-05-29
  // per owner directive to standardize role-switch placement across the 3
  // doorways instead of cramming it into the topBar). Mobile retains the
  // pill in the topBar's right-side cluster (lg:hidden wrapper) because
  // SidebarShell's sidebar is hidden at <lg viewports.
  const switchViewPill = (
    <RoleSwitchPill
      currentRole="admin"
      hasCustomerAccess={roles.hasCustomerAccess}
      hasVendorAccess={roles.hasVendorAccess}
      hasAdminAccess={roles.hasAdminAccess}
      vendorProfiles={roles.vendorProfiles}
    />
  );

  // Top bar — admin utilities cluster: brand logo (back to overview),
  // mobile-only Switch View pill, admin badge, display name, sign-out form.
  // Desktop topBar no longer carries the Switch View pill — it renders in
  // the sidebar footer slot (sidebarFooter prop below) where it's always
  // visible alongside the nav tree.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {/* Top-left EventSwitcher — replaces the "Setnayan · Admin" brand
          wordmark that sat here, so the switcher occupies the same top-left
          corner it holds on the customer doorway (owner directive 2026-06-02).
          Customer chrome carries no brand wordmark in this corner either
          (2026-05-15 chrome lock), so all three doorways read consistently.
          Cross-console hopping stays with the RoleSwitchPill on the right. */}
      <DashboardEventSwitcher primaryEvent={primaryEvent} switcherEvents={switcherEvents} />
      <div className="flex items-center gap-2">
        {/* Mobile-only Switch View pill — desktop renders it in the
            sidebar footer slot below (avoids duplicating the affordance
            inside the same viewport). */}
        <div className="lg:hidden">{switchViewPill}</div>
        <UnreadBellBadge
          userId={user.id}
          initialUnread={unreadCount}
          href="/admin/notifications"
          ariaBaseLabel="Notifications"
          ariaUnreadSuffix="unread"
        />
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${badge.tone}`}
        >
          {badge.label}
        </span>
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
      <SidebarShell sidebar={<AdminSidebar />} sidebarFooter={switchViewPill} topBar={topBar}>
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <AdminBottomNav />
      {!(profile?.tour_seen_keys ?? []).includes('admin_welcome_v1') ? (
        <GuidedTour tourKey="admin_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
