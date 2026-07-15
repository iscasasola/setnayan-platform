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
 * Full-screen LAUNCHER chrome — route group `(launcher)`, covering only the
 * account splash at `/dashboard` (owner 2026-07-09 "splash screen ... we do not
 * want side bar and menu bars here").
 *
 * Deliberately NOT the `(account)` SidebarShell. The launcher is the account
 * picker — a chrome-less splash that routes into everything — so this layout
 * renders only a slim top bar: the brand mark (→ /dashboard), the notifications
 * bell, and the account menu (Profile & Settings · sign out · switch
 * account/console live inside the AccountSwitcher panel). Every other account
 * surface (People · Memories Hub · Settings · Notifications · Setnayan AI) now
 * renders this SAME chrome-less top bar (owner 2026-07-13 — the old `(account)`
 * sidebar was retired for the launcher paradigm); the launcher links into them
 * as tiles and each spoke backs out via its own "Back to home" link.
 *
 * Auth/profile/deleted/vendor gating + the welcome tour stay in the parent
 * `dashboard/layout.tsx` (which renders the chrome-free `app-surface`). This
 * layout owns only the top-bar data (unread count + switcher).
 */
export default async function LauncherLayout({
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
    getSwitcherData(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Launcher] switcher data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
  ]);

  return (
    // The ambient Atelier wash — the warm paper + gold/slate glows the frosted
    // home cards sit ON (owner-approved final home design 2026-07-15; pixel
    // pass: the prototype's .win/.winwash gradient stack, defined once as
    // `.sn-wash-home` in globals.css). Scoped to the LAUNCHER route only — the
    // rest of the dashboard keeps the flat `--m-paper` from dashboard/layout.tsx
    // (the 2026-07-13 white-flatten stands everywhere but this home splash).
    <div className="sn-wash-home min-h-dvh">
      <header
        className="sn-reveal mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8"
        style={{ animationDelay: '0.12s' }}
      >
        <Link href="/dashboard" aria-label="Setnayan — home">
          <Wordmark />
        </Link>
        {/* Top-bar utility pill (proto .utilpill) — bell + avatar in one
            frosted capsule over the wash. */}
        <div className="flex items-center gap-1 rounded-full border border-white/[0.65] bg-white/45 p-1 shadow-[0_12px_30px_-22px_rgba(30,26,18,0.45)] backdrop-blur-[16px]">
          <UnreadBellBadge
            userId={user.id}
            initialUnread={unreadCount}
            href="/dashboard/notifications"
            ariaBaseLabel="Notifications"
            ariaUnreadSuffix="unread"
            pulse
          />
          <AccountSwitcher data={switcherData} />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
