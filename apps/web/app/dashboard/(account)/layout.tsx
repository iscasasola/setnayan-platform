import { redirect } from 'next/navigation';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import { getNavSlotMap } from '@/lib/nav-registry';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { AccountSidebar } from './_components/account-sidebar';

/**
 * Account-scoped dashboard chrome — route group `(account)` (URL-transparent),
 * covering the non-event dashboard surfaces: the event picker (`/dashboard`),
 * profile, notifications, create-event, api-keys.
 *
 * UNIVERSAL SIDEBAR (owner 2026-06-20 "universal style of side bar"). This
 * surface used to render `OuterDashboardHeader` — a near-empty 240px rail —
 * which made the sidebar visibly "different" from every event/vendor/admin page
 * (those already share <SidebarShell>). It now composes the SAME shell:
 *   - sidebarHeader: <DoorwaySidebarHeader label="Account"> (Wordmark + eyebrow
 *     + AccountSwitcherStandalone) — the one shared header used by all four
 *     doorways.
 *   - sidebar: <AccountSidebar> — the flat account nav (My Events ·
 *     Notifications · Profile & Settings · Marketplace · New event).
 *   - topBar: mobile utilities cluster (unread bell + AccountSwitcher pill).
 *     Carries the same affordances the old mobile strip had; everything else
 *     (events, profile, create-event, sign-out, console hops) lives in the
 *     switcher panel.
 *
 * SidebarShell owns the desktop offset (`--shell-main-offset`) entirely, so the
 * legacy `lg:pl-60` gutter is gone. There is no bottom-nav on the account
 * surface (it's transient — the prior chrome had none either).
 *
 * Auth/profile/deleted/vendor gating + the welcome tour stay in the parent
 * `dashboard/layout.tsx` (shared by this group AND the event subtree). This
 * layout owns only the chrome-data fetch (events/roles/unread/avatar/navSlots)
 * the header + sidebar need.
 */
export default async function AccountDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard'));
  // getDashboardShell fetches events + roles + unreadCount in one cached
  // Promise.all. React cache() deduplicates this call across layouts that
  // share the same render tree — any page or layout that also calls
  // getDashboardShell(user.id) in this request gets the already-resolved
  // result at zero DB cost.
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
  const [{ unreadCount }, switcherData, navSlots] = await Promise.all([
    getDashboardShell(user.id),
    // AccountSwitcher panel data. getSwitcherData never returns null after
    // the 2026-06-17 always-on fix; the .catch here guards against any
    // unexpected outer throw.
    getSwitcherData(user.id).catch((err: unknown) => {
      console.error('[AccountSwitcher] data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
    // Nav registry: admin-managed name+icon overrides, resolved server-side and
    // handed to the (client) account nav. Cached via NAV_REGISTRY_TAG, fails open.
    getNavSlotMap(),
  ]);

  // Top bar — mobile utilities cluster. The unread bell shows at all
  // breakpoints; the AccountSwitcher pill is mobile-only (lg:hidden), since on
  // desktop the switcher lives in the sidebar header (AccountSwitcherStandalone).
  // No standalone sign-out button by design (it lives in the switcher panel).
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      <UnreadBellBadge
        userId={user.id}
        initialUnread={unreadCount}
        href="/dashboard/notifications"
        ariaBaseLabel="Notifications"
        ariaUnreadSuffix="unread"
      />
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
      </div>
    </div>
  );

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={<DoorwaySidebarHeader label="Account" switcherData={switcherData} />}
        sidebar={<AccountSidebar navSlots={navSlots} />}
        topBar={topBar}
      >
        {/* Account pages have no bottom-nav, so no mobile bottom padding is
            needed. SidebarShell handles the desktop sidebar offset via its
            lg:pl-[var(--shell-main-offset)] math. */}
        <main>{children}</main>
      </SidebarShell>
    </div>
  );
}
