import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import {
  getSwitcherData,
  type SwitcherData,
} from '@/app/_components/account-switcher/get-switcher-data';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { Wordmark } from '@/app/_components/brand-marks';

/**
 * Account-scoped chrome — route group `(account)` (URL-transparent), covering
 * the non-event account SPOKES: profile · people · library (Memories Hub) ·
 * setnayan-ai · notifications · year · create-event · api-keys · life-flash ·
 * creator (Storyteller chapters — doorway'd from the launcher Spaces tile +
 * the account menu per the 2026-07-16 creator readiness verdict B4).
 *
 * CHROME-LESS, launcher-consistent (owner 2026-07-13: tapping Profile "goes to a
 * user-home with a side bar … an old menu … not [designed for] the … user
 * home"). The launcher at `/dashboard` is the home (owner 2026-07-09 "splash
 * screen … we do not want side bar and menu bars here"); these surfaces are its
 * spokes. They USED to render the old universal <SidebarShell> (the retired
 * user-home left rail via <AccountSidebar> / <DoorwaySidebarHeader> /
 * <AccountMobileNav>), which resurrected that paradigm every time you opened an
 * account page. This layout now renders the SAME slim top bar as
 * `(launcher)/layout.tsx` — Wordmark (→ home) · notifications bell · account
 * menu — and nothing else. Each spoke page carries its own "Back to home" link
 * and its own `mx-auto max-w-* px-*` container, so hub-and-spoke navigation is
 * self-contained with no persistent side rail.
 *
 * Auth/profile/deleted/vendor gating + the welcome tour stay in the parent
 * `dashboard/layout.tsx` (which already wraps children in `app-surface
 * min-h-dvh`). This layout owns only the top-bar data (unread count + switcher).
 */
export default async function AccountDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard'));

  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    isAnonymous: !!user.is_anonymous,
    photoUrl: null,
    events: [],
    context: { hasVendor: false, vendorName: null, isAdmin: false },
  };
  const [{ unreadCount }, switcherData] = await Promise.all([
    getDashboardShell(user.id),
    // getSwitcherData never returns null after the 2026-06-17 always-on fix; the
    // .catch guards against any unexpected outer throw so the chrome still paints.
    getSwitcherData(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Account] switcher data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
  ]);

  return (
    // `sn-ambient` = the canonical Atelier warm wash (Glass PR-1, 2026-07-15):
    // the account spokes now sit on the SAME canvas as the launcher home they're
    // one click from, instead of the old plain-white background.
    <div className="sn-ambient min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" aria-label="Setnayan — home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <UnreadBellBadge
            userId={user.id}
            initialUnread={unreadCount}
            href="/dashboard/notifications"
            ariaBaseLabel="Notifications"
            ariaUnreadSuffix="unread"
          />
          <AccountSwitcher data={switcherData} />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
