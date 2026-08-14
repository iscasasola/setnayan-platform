import { redirect } from 'next/navigation';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import {
  getSwitcherData,
  type SwitcherData,
} from '@/app/_components/account-switcher/get-switcher-data';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';

/**
 * Full-screen LAUNCHER chrome — route group `(launcher)`, covering only the
 * account splash at `/dashboard`.
 *
 * ── THE HEADER MOVED INTO THE PAGE (owner, 2026-07-30) ──────────────────────
 * This layout used to render a top bar: wordmark on the left, a bell + account
 * capsule on the right. The owner: "on the upper part, that is the header part.
 * we do not want this. it looks generic." — and then, after the page still led
 * with a full-width search block, "the search bar is still on top."
 *
 * Both rows are now ONE row. `_components/home-rail.tsx` carries the wordmark,
 * the search and the bell + AccountSwitcher together, rendered by the page so
 * it can sit sticky above the page's own content. NOTHING was deleted: every
 * control the header held is still rendered, which is the whole point — this
 * repo's recurring bug is nav flattens that remove the only door to a surface
 * (`Route_Wayfinding_Audit_2026-07-15`). Sign-out, profile and notifications
 * are reachable from the rail exactly as they were from the header.
 *
 * ⚠ SCOPE: this group contains ONLY `/dashboard`. The other account spokes
 * (people · library · profile · setnayan-ai · notifications · year) render
 * their own copy of the slim top bar from `(account)/layout.tsx` and are
 * UNTOUCHED by this change — do not "tidy" them to match without giving each
 * one its own rail first, or they lose their account menu.
 *
 * What remains here: auth and the ambient wash. Auth/profile/deleted/vendor
 * gating + the welcome tour stay in the parent `dashboard/layout.tsx`.
 *
 * ── AND, FROM 2026-08-13, THE SHARED RAIL ON DESKTOP ────────────────────────
 * 🔒 THIS DELIBERATELY REVERSES AN OWNER LOCK. The 2026-06-14 chrome retirement
 * and the owner's own rulings of 2026-07-09 ("splash screen … we do not want
 * side bar and menu bars here") and 2026-07-13 made this surface chrome-less on
 * purpose. The owner SUPERSEDED that on 2026-08-13, with three YouTube
 * screenshots in which the left rail never leaves: *"the sidebar should stay …
 * what you did was jumping back to the old dashboards."* Logged in
 * `DECISION_LOG.md` 2026-08-13 so no future session "restores" the chrome-less
 * launcher believing the older ruling still stands.
 *
 * ── AND, FROM 2026-08-14, THE SHARED TOP BAR (One top bar) ──────────────────
 * 🔑 `HomeRail` IS RETIRED AND ITS CONTRACT IS KEPT, NOT DROPPED. The owner's
 * 2026-07-30 ruling was about ROWS — "we do not want this header, it looks
 * generic", then "the search bar is still on top" — and the answer was one
 * line carrying identity, search and the account capsule. The shared bar IS
 * that line, and it is now the same line on all five signed-in trees, which is
 * what 2026-08-14 asked for: *"the issue is the top nav is not there?"*
 *
 * Every control `HomeRail` held is still rendered and every one is in the same
 * order: identity (wordmark → /dashboard) · search (the palette) · bell ·
 * AccountSwitcher. The bell and the switcher are the SAME components, handed
 * to the bar through `topBarSlot` rather than rebuilt — so sign-out, profile
 * and notifications cannot be lost in translation, which is the whole reason
 * this layout's earlier flatten was done that way too.
 *
 * ⚠ THE DATA MOVED BACK UP HERE from `(launcher)/page.tsx`, where it went on
 * 2026-07-30 so the rail could sit inside the page. The bar is chrome again,
 * so it is the layout's. Both reads fail soft: a switcher fetch that throws
 * degrades to a minimal panel rather than costing the user their only sign-out.
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
    context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false },
  };
  const [shellRes, switcherData] = await Promise.all([
    getDashboardShell(user.id).catch(() => ({ unreadCount: 0 })),
    getSwitcherData(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Launcher] switcher data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
  ]);

  return (
    // The ambient Atelier wash — the warm paper + gold/green/slate glows the
    // frosted home cards sit ON (canonical `.sn-ambient`, Glass PR-1). The rail
    // sits INSIDE the wash and paints its own cream, so the wash still reaches
    // the content column exactly as before.
    <div className="sn-ambient min-h-dvh">
      <AppRailShell
        topBarSlot={
          <>
            <UnreadBellBadge
              userId={user.id}
              initialUnread={shellRes.unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
              pulse
            />
            <AccountSwitcher data={switcherData} />
          </>
        }
      >
        <main>{children}</main>
      </AppRailShell>
    </div>
  );
}
