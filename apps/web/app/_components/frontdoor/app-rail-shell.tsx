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
  railToolsSignedOut,
  resolveRailStudioEvent,
  resolveRailAccount,
  toRailFolder,
} from './rail-data';
import { resolveCommandItems } from './command-data';
import { SignedInCluster } from './signed-in-cluster';
import { HomeCommandBar } from '@/app/dashboard/(launcher)/_components/home-command-bar';

export async function AppRailShell({
  children,
  railContext,
  topBarSlot,
  variant = 'app',
  bleed,
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
  /**
   * Run the content column edge-to-edge — no side gutters, no 1600px cap.
   * Pure pass-through to the shell; see `FrontDoorShell`'s `bleed` for the
   * measured reason it exists and why it is deliberately rare. Only a browse
   * GRID should pass it; a reading page wants the measured column.
   */
  bleed?: boolean;
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
      bleed={bleed}
      account={account}
      navLabels={navLabels}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      /*
        ⚠ NO `demo` IS EVER PASSED HERE. Signed-in surfaces mount no overlay
        host, and a row offering a demo that cannot open is a fake door. It is
        also the wrong offer: these people own the product.
      */
      /*
        🔴 WHO IS LOOKING, NOT WHICH PAGE THEY ARE ON. Owner 2026-08-15: *"same
        as studio and its sub mene also"* — pressing a Studio row visibly
        changed the Studio group itself. Measured live: seven descriptions and
        three "try it" markers on `/`, ZERO of each on `/papic`, because this
        line asked for the signed-IN rows unconditionally while the front door
        asked for the signed-OUT ones. `railToolsSignedIn` sets `line: null` by
        design ("signed in, silence beats selling") — the function was right,
        the caller never asked the question.

        Now BOTH mounts branch on the same thing, so the group cannot change
        shape as you move between pages:
          signed out → the descriptions and the "try it" markers
          signed in  → your own tools, no selling copy
      */
      tools={
        account.signedIn ? railToolsSignedIn(studioEvent) : railToolsSignedOut()
      }
      railContext={railContext}
      /*
        🔴 A DOORWAY PAGE HANDS IN NO CLUSTER, AND THE SHELL'S FALLBACK IS
        WRITTEN FOR A STRANGER. Owner 2026-08-15, two screenshots: *"why does
        the top nav differ?"* The five app trees pass `topBarSlot` and got the
        real bell + switcher; `variant="doorway"` pages (About, Alaala, Explore,
        Real Stories, the eight product pages, the legal chrome) passed nothing
        and fell through to a "🔔" EMOJI that can never carry an unread count.
        Signed in, that is not a placeholder — it is a worse bar.

        So the DEFAULT for a signed-in visitor is now the real cluster, and a
        host that hands in its own still wins. `SignedInCluster` returns null
        when nobody is signed in, so the signed-out doorway is byte-identical.
        See `signed-in-cluster.tsx` for the measured no-cost note.
      */
      topBarSlot={topBarSlot ?? (account.signedIn ? <SignedInCluster /> : undefined)}
      /*
        THE SEARCH FOLLOWS WHO IS LOOKING, NOT WHICH PAGE THEY ARE ON — the
        third time this file settles that question the same way (the Studio
        rows above, the account cluster above that).

        🔴 THIS LINE WAS UNCONDITIONAL AND ITS PREMISE HAD MOVED. The 2026-08-14
        ruling — "the palette wins, because every surface this bar mounts on is
        INSIDE the person's own app" — was TRUE THE DAY IT WAS WRITTEN: slice 0
        mounted five signed-in trees. On 2026-08-15 the eight product doorways,
        About, Explore, Real Stories, Pricing and the legal chrome mounted this
        same shell with `variant="doorway"`, and nobody re-asked the search
        question. A stranger on /setnayan-ai was then offered a palette
        labelled "Search events, people, vendors" over events, people and
        vendors they do not have: `resolveCommandItems` returns `[]` with no
        session, so pressing it opened an EMPTY list, and typing produced
        exactly one row — the marketplace escape. Two presses to reach what
        the front door answers with Enter. Owner 2026-08-16, two screenshots:
        *"i think the top nav is still not fixed. the search tab looks
        different."*

        So: signed in → the palette (their own things, marketplace escape row
        keeps it lossless). Signed out → `undefined`, which the shell falls
        back to the marketplace GET form — the SAME box `/` has always shown.
        One search per person across every public page and every app tree.

        💸 The palette is not even BUILT for a stranger now: `commandItems` is
        `[]` either way, and this stops mounting a client component and its
        ⌘K listener on a page whose visitor it can never answer.
      */
      search={
        account.signedIn ? (
          <HomeCommandBar items={commandItems} variant="rail" />
        ) : undefined
      }
    >
      {children}
    </FrontDoorShell>
  );
}
