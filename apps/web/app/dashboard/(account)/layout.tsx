import { redirect } from 'next/navigation';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import { OuterDashboardHeader } from '@/app/dashboard/_components/outer-dashboard-header';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

/**
 * Account-scoped dashboard chrome — route group `(account)` (URL-transparent),
 * covering the non-event dashboard surfaces: the event picker (`/dashboard`),
 * profile, notifications, create-event, api-keys.
 *
 * SPLIT OUT of `dashboard/layout.tsx` 2026-06-14 (chrome retirement). The old
 * parent layout rendered `OuterDashboardHeader` + a `bg-cream lg:pl-60` gutter
 * UNCONDITIONALLY for every `/dashboard` route — including event routes, where
 * the header was suppressed only by a CLIENT `usePathname()` guard and the
 * gutter cancelled by a `lg:-ml-60` hack in `[eventId]/layout.tsx`. Result:
 * the legacy cream chrome painted first on event navigations, then vanished
 * after hydration — the "old design flashes, then reroutes to the new design"
 * report. By moving the account chrome into this group it renders ONLY on the
 * account routes (structurally, server-side); the parent layout owns no chrome;
 * and `[eventId]/layout.tsx` owns the paper SidebarShell alone. No dual-render,
 * no `-ml-60` cancel, no flash. The header is restyled to the v2.1 `--m-*`
 * paper palette so the old cream design is fully retired.
 *
 * Auth/profile/deleted/vendor gating + the welcome tour stay in the parent
 * `dashboard/layout.tsx` (shared by this group AND the event subtree). This
 * layout owns only the chrome-data fetch (events/roles/unread/avatar) that the
 * header switcher needs — the same fetch the event layout runs independently.
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
  const [{ unreadCount }, switcherData] = await Promise.all([
    getDashboardShell(user.id),
    // AccountSwitcher panel data. getSwitcherData never returns null after
    // the 2026-06-17 always-on fix; the .catch here guards against any
    // unexpected outer throw.
    getSwitcherData(user.id).catch((err: unknown) => {
      console.error('[AccountSwitcher] data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
  ]);

  return (
    <div
      className="app-surface flex min-h-dvh flex-col lg:pl-60"
      style={{ background: 'var(--m-paper)' }}
    >
      {/* lg:pl-60 offsets the OuterDashboardHeader's 240px desktop sidebar
          (fixed left). On account routes the header ALWAYS renders, so the
          gutter is structurally correct — no client guard, no flash. */}
      <OuterDashboardHeader
        unreadCount={unreadCount}
        switcherData={switcherData}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
