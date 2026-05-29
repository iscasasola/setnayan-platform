import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { countUnread } from '@/lib/notifications';
import { fetchUserRoleSummary } from '@/lib/roles';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { VendorSidebar } from './_components/vendor-sidebar';
import { VendorBottomNav } from './_components/vendor-bottom-nav';

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

  const [profileRes, unreadCount, roles] = await Promise.all([
    supabase
      .from('users')
      .select('account_type, email, display_name, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    fetchUserRoleSummary(supabase, user.id),
  ]);
  const profile = profileRes.data;

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Vendor-access gate — canonical "do they have vendor access" rule lives in
  // `fetchUserRoleSummary` (apps/web/lib/roles.ts:165-167): a user has access
  // if they own a `vendor_profiles` row OR sit on any `vendor_team_members`
  // row, regardless of `users.account_type`. This matches the rule the
  // always-visible RoleSwitchPill uses to decide whether to offer the "Shop
  // console" target (apps/web/app/_components/role-switch-pill.tsx:82-95).
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

  // Top bar lives inside SidebarShell's topBar slot. Carries the vendor
  // utilities cluster — brand logo (links back to vendor home), role-
  // switch pill, live unread bell, display name, sign-out form.
  // Pre-Phase 2 this sat inside a <header> element above the horizontal
  // pill nav; now it sits inside the sticky top slot above the main
  // content scroll.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      <Link href="/vendor-dashboard" className="flex items-center text-ink">
        <Logo height={32} withWordmark title="Setnayan · Vendor" />
      </Link>
      <div className="flex items-center gap-2">
        <RoleSwitchPill
          currentRole="vendor"
          hasCustomerAccess={roles.hasCustomerAccess}
          hasVendorAccess={roles.hasVendorAccess}
          hasAdminAccess={roles.hasAdminAccess}
          vendorProfiles={roles.vendorProfiles}
        />
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
    <>
      <SidebarShell sidebar={<VendorSidebar />} topBar={topBar}>
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <VendorBottomNav />
    </>
  );
}
