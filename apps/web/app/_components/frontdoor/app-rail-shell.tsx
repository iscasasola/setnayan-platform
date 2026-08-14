/**
 * app-rail-shell.tsx — the shared rail, mounted on a signed-in surface.
 *
 * One Shell slice 0. Owner, 2026-08-13, over three YouTube screenshots in
 * which the left rail never leaves: *"the sidebar should stay. look at here as
 * we navigate around. what you did was jumping back to the old dashboards. so
 * what we want to see the dashboards converted for this desktop view."*
 * `DECISION_LOG.md` 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md`.
 *
 * ─── THIS IS NOT A SECOND SHELL ──────────────────────────────────────────
 * It is the server half — the same role `front-door.tsx` plays for `/`. It
 * gathers the account, the tools and the folders from the ONE shared source
 * and renders the ONE shared `<FrontDoorShell>` in its app variant. Every
 * rendering decision lives in that component; nothing about the rail's shape
 * is decided twice.
 *
 * ─── MOUNTED PER TREE, NEVER "ROUTED THROUGH /" ──────────────────────────
 * 🪤 The native apps can never reach `/` — middleware bounces Capacitor and
 * Tauri off the marketing paths (owner-locked 2026-06-10, login-first). Any
 * design that sends signed-in people through the homepage to pick up its
 * chrome would work on the web and strand every desktop and mobile app user.
 * So this mounts INSIDE the dashboard layouts, exactly as `SidebarShell` does
 * in the other three trees.
 *
 * ⚠ ON PUBLIC PAGES, ONLY WITH `variant="doorway"` AND ONLY WHERE THE PAGE HAS
 * BEEN MADE DYNAMIC. This paragraph used to forbid public mounts outright, and
 * its stated mechanism was WRONG — in the less dangerous direction.
 *
 * 🔴 THE REAL TRAP: on a `force-static` page, Next 15.5.21 does not de-cache
 * and does not throw. `next/dist/server/request/cookies.js` returns an EMPTY
 * COOKIE JAR — that branch sits BEFORE the `dynamicShouldError` throw and
 * BEFORE every bailout — so the page builds green, stays edge-cached, and
 * serves a PERMANENTLY SIGNED-OUT rail for an hour at a time. `headers.js`
 * carries the byte-identical hole, so an audit grepping only for `cookies()`
 * passes a page that is just as blind. A bill you can see is a nuisance; a
 * signed-in person shown a signed-out shell with nothing logged is the disease.
 *
 * The seven product doorways therefore declare `dynamic = 'force-dynamic'`
 * (2026-08-15) and mount this from `_doorway.tsx`. `/blog` and Real Stories are
 * NOT mounted and would still need the same treatment first.
 */
import 'server-only';

import { getNavSlotMap } from '@/lib/nav-registry';
import {
  FRONT_DOOR_VISIBLE_FOLDERS,
  FRONT_DOOR_MORE_FOLDERS,
} from '@/lib/taxonomy-folder-counts';

import './front-door.css';
import { FrontDoorShell, type RailNavLabels } from './front-door-shell';
import {
  railToolsSignedIn,
  resolveRailStudioEvent,
  resolveRailAccount,
  toRailFolder,
} from './rail-data';
import { resolveCommandItems } from './command-data';
import { HomeCommandBar } from '@/app/dashboard/(launcher)/_components/home-command-bar';

export async function AppRailShell({
  children,
  railContext,
  topBarSlot,
  variant = 'app',
}: {
  children: React.ReactNode;
  /**
   * The per-surface group that PUSHES in below the account rows. Slice 0 (the
   * events board and the account spokes) has no sub-navigation and passes
   * nothing; slice 1 mounts "In this event — {name}" here.
   */
  railContext?: React.ReactNode;
  /**
   * The surface's OWN top-bar utility cluster, handed straight through to the
   * shared bar — its live bell, its account switcher, and anything only it
   * has (an event's unread chat, the admin's SLA pill and environment badge).
   *
   * 🔑 EVERY TREE MUST PASS ONE. It is optional in the type only because the
   * shell has a signed-out fallback for `/`; a signed-in surface that passes
   * nothing renders this page's generic bell and account menu instead of its
   * own, which on the vendor and admin doorways would mean a bell pointed at
   * the wrong inbox and — worse — a different Sign out from the one every
   * other control on that screen leads to. `one-top-bar.test.ts` fails if a
   * tree stops passing it.
   */
  topBarSlot?: React.ReactNode;
  /**
   * Which chrome. Defaults to the signed-in `app`.
   *
   * `doorway` is the PUBLIC product pages (/papic, /panood, …): front-door
   * chrome, but the page owns its own <main> and <h1>. See the variant note in
   * `front-door-shell.tsx` for why `app` is actively wrong there — it drops the
   * hamburger on a surface whose rail is `display:none` below 1024, leaving a
   * phone with no navigation, and points the wordmark at /dashboard, which
   * redirects a stranger to /login.
   */
  variant?: 'app' | 'doorway';
}) {
  const [account, navLabels, commandItems, studioEvent] = await Promise.all([
    resolveRailAccount(),
    /*
      🔑 LABELS COME FROM THE NAV REGISTRY, which is where an admin renames
      them. The mobile navs already read these slots; if the rail hard-coded
      its own words instead, an admin rename would apply on the phone and not
      on the desktop — two answers to one question, and no error to notice.

      A FAILED READ FALLS BACK TO THE IN-CODE WORDS, never to a blank rail.
      `getNavSlotMap` is cached, so this is one read per request at most.
    */
    getNavSlotMap().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[AppRailShell] nav slot read failed:', err);
      return {} as RailNavLabels;
    }),
    /*
      🔑 ONE INDEX FOR THE ONE SEARCH. Built here, for every tree, from the
      single shared builder — the launcher used to build its own inline, which
      would have listed different things on `/dashboard` than inside a wedding
      with nothing to notice. Its reads are all React `cache()`d at source, so
      on the launcher (which already calls the same three) this costs nothing.
      It degrades to `[]` rather than throwing: a palette with a short list is
      a working bar, a shell that throws is a blank screen.
    */
    resolveCommandItems(),
    /*
      WHICH EVENT THE STUDIO ROWS OPEN — owner 2026-08-14: *"when logged in, it
      will be different view."* A signed-in person pressing "Papic" wants THEIR
      Papic, not the page that sells it. Exactly one event opens straight into
      the tool; several send them to the board (which is the picker) rather than
      guessing which wedding they meant; none keeps the public page, because the
      page that explains the product is what somebody without an event needs.
      All reads are React cache()d and shared with the resolvers above.
    */
    resolveRailStudioEvent(),
  ]);

  return (
    <FrontDoorShell
      variant={variant}
      account={account}
      navLabels={navLabels}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      /*
        ⚠ NO `demo` IS EVER PASSED HERE. Signed-in surfaces mount no overlay
        host, and a row offering a demo that cannot open is a fake door. It is
        also the wrong offer: these people own the product.
      */
      tools={railToolsSignedIn(studioEvent)}
      railContext={railContext}
      topBarSlot={topBarSlot}
      /*
        THE SEARCH INSIDE THE APP IS THE PALETTE, NOT THE MARKETPLACE FORM.
        See the shell's file header: everything this variant wraps is a room in
        the person's own house, so "where is my thing" is the question, and the
        palette carries the marketplace as an escape row so nothing is lost.
      */
      search={<HomeCommandBar items={commandItems} variant="rail" />}
    >
      {children}
    </FrontDoorShell>
  );
}
