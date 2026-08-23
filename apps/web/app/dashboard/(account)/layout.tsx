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
import { HomePillNav } from '../(launcher)/_components/home-pill-nav';

/**
 * Account-scoped chrome — route group `(account)` (URL-transparent), covering
 * the non-event account SPOKES: profile · people · library (Alaala — the route
 * keeps its /dashboard/library URL; the surface was renamed 2026-07-31) ·
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
 *
 * ── AND, FROM 2026-08-13, THE SHARED RAIL ON DESKTOP ────────────────────────
 * 🔒 THIS DELIBERATELY REVERSES THE OWNER LOCK DESCRIBED TWO PARAGRAPHS ABOVE.
 * The 2026-07-13 ruling that made these spokes chrome-less was SUPERSEDED by
 * the owner on 2026-08-13: *"the sidebar should stay … what you did was jumping
 * back to the old dashboards. so what we want to see the dashboards converted
 * for this desktop view."* `DECISION_LOG.md` 2026-08-13.
 *
 * 🔑 THE OLD PARAGRAPH IS LEFT STANDING ON PURPOSE — it explains why the
 * RETIRED rail was retired, and that reasoning still holds: what came back is
 * not `<SidebarShell>`/`<AccountSidebar>`, it is the front door's own rail, so
 * signing in no longer changes the shape of the site. Deleting the history
 * would invite someone to reinstate the retired one.
 *
 * ── AND, FROM 2026-08-14, THE SHARED TOP BAR (One top bar) ──────────────────
 * The slim bar this layout drew is GONE, and its two controls were not: the
 * bell and the AccountSwitcher are handed to the shared bar through
 * `topBarSlot`, as the same elements, so the only account menu and the only
 * sign-out on these surfaces are exactly where they were, one press from the
 * same corner. What changed is that they now sit in the SAME bar the events
 * board and every wedding carry.
 *
 * 🔑 THE WORDMARK BECAME THE SHARED BAR'S. This layout drew its own `<Wordmark>`
 * linking to /dashboard; the shared bar draws one and points it at /dashboard
 * inside the app. Same word, same destination, one implementation — the point
 * of the owner's 2026-08-14 note, which was that Alaala had a wordmark, the
 * board had a wordmark and a search, and a wedding had neither.
 *
 * ⚠ AND THESE SPOKES GAINED A SEARCH. They had none; the shared bar's palette
 * reaches this person's own events, spaces and account destinations from here
 * too. That is an addition, not a replacement — nothing was removed to make
 * room for it.
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
    // This literal exists BECAUSE a read failed — it measured nothing, and
    // saying so is what stops the library reporting that you host no events.
    eventsMeasured: false,
    context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false },
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
      <AppRailShell
        topBarSlot={
          <>
            <UnreadBellBadge
              userId={user.id}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <AccountSwitcher data={switcherData} />
          </>
        }
      >
        {/* `pb-28 sm:pb-0` — the thumb bar is `fixed`, so without room reserved
            below it the last control on a spoke sits UNDER it. The launcher
            reserves the same space on its own page. */}
        <main className="pb-28 sm:pb-0">{children}</main>
        {/* Phone-only thumb nav — rendered by the LAYOUT, not by a page, so it
            survives the tap that uses it. Its capability-gated fifth slot reads
            the switcher context this layout already loaded; no new query. */}
        <HomePillNav
          hasSpaces={switcherData.context.hasVendor || switcherData.context.isAdmin}
          spacesHref={switcherData.context.hasVendor ? '/vendor-dashboard' : '/admin'}
        />
      </AppRailShell>
    </div>
  );
}
