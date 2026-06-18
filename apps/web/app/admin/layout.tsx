import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSocialFlush } from '@/lib/social/flush';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { countUnread } from '@/lib/notifications';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { Wordmark } from '@/app/_components/brand-marks';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminBottomNav } from './_components/admin-bottom-nav';
import { getNavSlotMap } from '@/lib/nav-registry';
import { AccountSwitcher, AccountSwitcherStandalone } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

export const metadata = { title: 'Setnayan HQ' };

/**
 * Admin layout — v2.1 Navigation Phase 3 (admin doorway).
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). The sidebarHeader carries the brand
 * wordmark + HQ label + AccountSwitcherStandalone (matching the customer
 * doorway pattern — owner directive 2026-06-18). The topBar is right-aligned:
 * unread bell · role badge · display name · sign-out · AccountSwitcher
 * (mobile-only pill; desktop uses the sidebar AccountSwitcherStandalone).
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * AccountSwitcher owns identity + event switching + cross-console hopping on
 * all three doorways, consistent with the customer doorway that already shipped
 * this pattern.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin'));
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
    context: { hasVendor: false, vendorName: null, isAdmin: true },
  };

  const [{ data: profile }, unreadCount, switcherData] = await Promise.all([
    supabase
      .from('users')
      .select(
        'display_name, email, account_type, is_internal, is_team_member, tour_seen_keys',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    getSwitcherData(user.id).catch((err: unknown) => {
      logQueryError(
        'AdminLayout (getSwitcherData threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return minimalSwitcherFallback;
    }),
  ]);

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

  // Non-admins get a 404 rather than a redirect so the /admin route doesn't
  // leak its own existence.
  if (!isAdmin) notFound();

  // Social auto-publish flush — cron-free: dispatch piggybacks on admin
  // traffic via after(). Fire-and-forget; the 10-min throttle inside
  // runSocialFlush makes this effectively free, and it never throws.
  after(() => runSocialFlush().catch(() => {}));

  const displayName = profile?.display_name ?? profile?.email ?? 'Setnayan Team';

  const badge = profile?.is_internal
    ? { label: '🟣 Internal', tone: 'bg-purple-100 text-purple-800' }
    : profile?.is_team_member
      ? { label: '🟢 Team Pool', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Setnayan Team', tone: 'bg-ink/10 text-ink/70' };

  // Top bar — right-aligned utilities cluster. AccountSwitcher pill is
  // mobile-only (lg:hidden); desktop users open the switcher from the
  // AccountSwitcherStandalone row in the sidebar header.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
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
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
      </div>
    </div>
  );

  // Nav registry: admin-managed name+icon overrides, resolved server-side and
  // handed to the (client) admin nav. Cached via NAV_REGISTRY_TAG, fails open.
  const navSlots = await getNavSlotMap();

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={
          <>
            <header className="px-4 py-3">
              <Wordmark />
              <p className="m-label-mono mt-1.5" style={{ color: 'var(--m-slate-2)' }}>Setnayan HQ</p>
            </header>
            <div className="px-3 pb-3">
              <AccountSwitcherStandalone data={switcherData} />
            </div>
          </>
        }
        sidebar={<AdminSidebar navSlots={navSlots} />}
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
      <AdminBottomNav navSlots={navSlots} />
      {!(profile?.tour_seen_keys ?? []).includes('admin_welcome_v1') ? (
        <GuidedTour tourKey="admin_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
