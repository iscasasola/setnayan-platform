import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { countUnread } from '@/lib/notifications';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { VendorSidebar } from './_components/vendor-sidebar';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isMusicVendor } from '@/lib/songs';
import { VendorBottomNav } from './_components/vendor-bottom-nav';
import { VendorNavFab } from './_components/vendor-nav-fab';
import { resolveVendorRole } from '@/lib/vendor-role';
import { getNavSlotMap } from '@/lib/nav-registry';
import { PushNotificationRegistrar } from './_components/push-notification-registrar';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

/**
 * Vendor dashboard layout — v2.1 Navigation Phase 2 (vendor doorway).
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). The sidebarHeader carries the brand
 * wordmark + Vendor eyebrow + AccountSwitcherStandalone (matching the
 * customer and admin doorway patterns — owner directive 2026-06-18). The
 * topBar is right-aligned: unread bell · display name · sign-out ·
 * AccountSwitcher (mobile-only pill; desktop uses the sidebar standalone).
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * AccountSwitcher owns identity + event switching + cross-console hopping
 * on all three doorways, consistent with the customer doorway.
 */
export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard'));
  const supabase = await createClient();

  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    photoUrl: null,
    events: [],
    gallery: [],
    favorites: [],
    editorials: [],
    context: { hasVendor: true, vendorName: null, isAdmin: false },
  };

  const [profileRes, unreadCount, switcherData, vendorRole, vendorProfile] = await Promise.all([
    supabase
      .from('users')
      .select('account_type, email, display_name, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    getSwitcherData(user.id).catch((err: unknown) => {
      logQueryError(
        'VendorDashboardLayout (getSwitcherData threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return minimalSwitcherFallback;
    }),
    // Vendor team role for the role-aware nav shell (owner/admin = full nav,
    // agent/viewer = scoped). Resolved here so both the sidebar + bottom-nav
    // render from one source.
    resolveVendorRole(supabase, user.id),
    // Vendor profile (own or via team membership) — drives service-aware nav:
    // Repertoire only exists for music acts (owner directive 2026-06-13).
    // Defensive .catch(): nav gating must never crash the layout.
    fetchOwnVendorProfile(supabase, user.id).catch(() => null),
  ]);
  const profile = profileRes.data;
  // Service-aware nav: Repertoire is a music-act surface only.
  const showRepertoire = isMusicVendor(vendorProfile?.services);

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Login-driven ghosting check (no cron) — after the response, once per login
  // (gated inside the helper). Vendor side: nudge if inquiries they received
  // sit unanswered past the threshold.
  after(() => runLoginGhostingCheck(user.id, 'vendor'));

  // Vendor-access gate — canonical rule: a user has access if they own a
  // vendor_profiles row OR sit on any vendor_team_members row. getSwitcherData
  // resolves this via fetchUserRoleSummary internally and surfaces it as
  // context.hasVendor. Matches what the unified AccountSwitcher uses for the
  // "Shop console" target.
  if (!switcherData.context.hasVendor) {
    redirect('/dashboard');
  }

  const displayName = profile?.display_name ?? profile?.email ?? 'Vendor';

  // Top bar — right-aligned utilities cluster. AccountSwitcher pill is
  // mobile-only (lg:hidden); desktop users open the switcher from the
  // AccountSwitcherStandalone row in the sidebar header.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
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
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
      </div>
    </div>
  );

  // Nav registry: admin-managed name+icon overrides, resolved server-side and
  // handed to the (client) vendor nav. Cached via NAV_REGISTRY_TAG, fails open.
  const navSlots = await getNavSlotMap();

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={<DoorwaySidebarHeader label="Vendor" switcherData={switcherData} />}
        sidebar={<VendorSidebar role={vendorRole} showRepertoire={showRepertoire} navSlots={navSlots} />}
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <VendorBottomNav role={vendorRole} navSlots={navSlots} />
      {/* NAV-2 broken-out action — Check inquiries (a sibling of the pill,
          never a tab). Hides itself when a docked SubNav is up. */}
      <VendorNavFab />
      {/* Push notification opt-in banner. Client-only; renders null once the
          vendor has granted push permission or dismissed the prompt. */}
      <PushNotificationRegistrar />
    </div>
  );
}
