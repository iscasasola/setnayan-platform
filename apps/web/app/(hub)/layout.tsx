import { AppPreload } from '@/app/_components/app-preload';
import { appPreloadPlan, hostedEventOf } from '@/lib/app-preload-sets';
import { hubDrawsTheShell } from '@/lib/hub-shell';
import { getDashboardShell } from '@/lib/dashboard-shell';
import {
  getSwitcherData,
  type SwitcherData,
} from '@/app/_components/account-switcher/get-switcher-data';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { placeWhoFromSwitcher } from '@/lib/notification-place';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';
import { RevealWhatIsSeen } from '@/app/_components/reveal-what-is-seen';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import { accountBarTabs } from '@/lib/account-bar';
import { discoverOpensHere } from '@/lib/request-platform';

/**
 * ONE LAYOUT FOR HOME AND DISCOVER — route group `(hub)`, covering `/` and `/dashboard` (owner 18 Nov 2026, verbatim:
 * *"yes, unify home and discover on fable"*; DECISION_LOG 2026-11-17 "navigation bars should not load with the
 * screen … Top bar, tab bar and rail live in the shared layout and never remount or redraw on a tab or page change").
 *
 * 🔴 THE FAULT THIS CLOSES. Signed in, Home (`/dashboard`, then under `app/(hub)/layout.tsx`) and
 * Discover (`/`, `app/(hub)/page.tsx`) shared no layout below the root, so the tap between them mounted a NEW top bar and a
 * NEW rail — measured on live f8f278f at 390 px: `header.fd-topbar` and the Menu button were new DOM nodes after the
 * tap; the view-transition slide only hid the swap. The two bars did not even look alike: Home drew the gold mark and
 * a plain avatar (this layout's app variant), Discover drew text-only SETNAYAN and its own copy of the cluster.
 *
 * 🔑 THE FIX IS WHERE THE FILES SIT, NOT WHAT THEY DRAW. Next keeps a layout mounted across a navigation only when
 * both pages are below it. So both pages now live under this group, and this file draws the chrome the launcher
 * layout already drew — the same `AppRailShell` (app variant, the drawing's look:
 * `prototypes/user_dashboard_clean_2026-11-17/…_fable.html` draws ONE bar for both), the same bell + switcher, the
 * same account bar. No URL moved: a route group adds no segment.
 *
 * 🔒 SIGNED OUT, THIS FILE DRAWS NOTHING. `/` stays the public front door exactly as it was (#7840: "signed out sees
 * the front door only") — `FrontDoor` still renders its own front-door shell for a stranger, and `/dashboard`'s own
 * gate (`dashboard/layout.tsx`, re-used by `(hub)/dashboard/layout.tsx`) still sends a stranger to sign in. The one
 * question "is the shell drawn here" is asked in ONE place (`lib/hub-shell.ts`) by both this layout and `FrontDoor`,
 * so they can never both draw a bar, or neither.
 *
 * 💸 FEWER READS, NOT MORE: Discover used to read the bell + switcher a second time through `SignedInCluster` and the
 * account bar's own auth check (`FrontDoorAccountBar`); both are this layout's now, read once.
 *
 * The history below is the launcher layout's, moved here with it — every rule in it still holds.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * (was) Full-screen LAUNCHER chrome — route group `(launcher)`, covering only the
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
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await hubDrawsTheShell();
  // Signed out: nothing of ours. `/` draws the public front door itself; `/dashboard`'s gate redirects to sign in.
  if (!user) return <>{children}</>;

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
    context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false, shops: [] },
  };
  const [shellRes, switcherData, discoverOpen] = await Promise.all([
    getDashboardShell(user.id).catch(() => ({ unreadCount: 0 })),
    getSwitcherData(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Launcher] switcher data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
    // Is `/` a door here, or does the app shell bounce it? (lib/request-platform.ts)
    discoverOpensHere(),
  ]);

  return (
    // The ambient Atelier wash — the warm paper + gold/green/slate glows the
    // frosted home cards sit ON (canonical `.sn-ambient`, Glass PR-1). The rail
    // sits INSIDE the wash and paints its own cream, so the wash still reaches
    // the content column exactly as before.
    <div className="sn-ambient min-h-dvh">
      <AppRailShell
        /* 📱→🖥 THE ACCOUNT TREE IS A TABLET FROM 701 (owner-approved plan D5, "Account/launcher onto the 701 line",
           2026-11-13): the rail's 72-px strip comes down to 701 and the account bar goes with it — ONE boundary, given
           to the shell AND the dock, as the event tree and the supplier dashboard do. Below 701 nothing moves. */
        boundary="tab"
        topBarSlot={
          <>
            <UnreadBellBadge
              userId={user.id}
              initialUnread={shellRes.unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
              pulse
              who={placeWhoFromSwitcher(switcherData)}
            />
            <AccountSwitcher data={switcherData} />
          </>
        }
      >
        {/* The bar is anchored and FIXED, so the page reserves its measured
            height (+ a breath) wherever it is drawn — below 701, the dock's own
            `tab:hidden` line (plan D5). */}
        {/* ↔ `.sn-vt-page` — the bar's page slide moves THIS, the same slide as the event and the shop (owner
            2026-10-24); `while-sliding` names it only while a slide runs (globals.css). */}
        <main
          className="sn-vt-page pb-[max(calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem),var(--sn-thumb-room,0px))] tab:pb-[var(--sn-thumb-room,0px)]"
          data-sn-slide="while-sliding"
        >
          {children}
          {/* 👁 A reveal plays only for what is on screen; a jump never lands on a blank (walker D7, 18 Nov). */}
          <RevealWhatIsSeen />
        </main>
        {/* The account bar — rendered by the LAYOUT, not by a page, so it
            survives the tap that uses it. Its tabs are the 2026-10-21 ruling
            (lib/account-bar.ts): Shop only for an OWNER, from the switcher
            context this layout already loaded; Discover only where `/` opens. */}
        <AccountBarSlot
          tabs={accountBarTabs({ discoverOpen })}
          boundary="tab"
          hasShop={switcherData.context.hasVendor}
        />
        {/* 📲 What the account has, preloaded once the page is idle — the host app for
            the event they host, the supplier app for a shop (owner 2026-10-02, "THE
            PRELOAD FOLLOWS WHAT THE ACCOUNT HAS"). From the switcher data this layout
            already read; nothing for a guest-only account. */}
        <AppPreload
          {...appPreloadPlan({ hostEventId: hostedEventOf(switcherData.events), hasShop: switcherData.context.hasVendor })}
        />
      </AppRailShell>
    </div>
  );
}
