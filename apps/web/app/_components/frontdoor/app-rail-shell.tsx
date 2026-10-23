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
import { DOORWAY_BLEED_PATHS } from './shell-bleed';
import 'server-only';

import { getNavSlotMap } from '@/lib/nav-registry';

import './front-door.css';
import { FrontDoorShell, type RailNavLabels } from './front-door-shell';
import type { RailFocus } from './rail-focus';
import type { RailMatchRow } from './rail-active';
import { resolveRailAccount } from './rail-data';
import { discoverOpensHere } from '@/lib/request-platform';
import { SignedInCluster } from './signed-in-cluster';
import type { ShellBoundary } from '@/app/_components/shell-boundary';

export async function AppRailShell({
  children,
  railContext,
  contextMatchRows,
  focus,
  topBarSlot,
  searchSlot,
  createSlot,
  variant = 'app',
  bleed,
  boundary,
}: {
  children: React.ReactNode;
  /**
   * The per-surface group that PUSHES in below the account rows. Slice 0 (the
   * events board and the account spokes) has no sub-navigation and passes
   * nothing; slice 1 mounts "In this event — {name}" here.
   */
  railContext?: React.ReactNode;
  /** The `railContext` child's rows, as match data — see the shell's own
   *  prop note. Pure pass-through; the shell resolves the union. */
  contextMatchRows?: ReadonlyArray<RailMatchRow>;
  /** Collapse the rail to this section's menu + one way back. Pure
   *  pass-through — see the shell's `focus` prop note. */
  focus?: RailFocus;
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
   * A doorway's own search control, when the shared palette is the wrong one.
   *
   * 🔴 ADDED 2026-08-26 BECAUSE THE OWNER COULD NOT FIND WHAT HAD SHIPPED.
   * The admin gained a search that knows its 96 pages, 284 jobs and its price
   * rows, and can answer a whole sentence — and it sat behind ⌘K, unlabelled.
   * The only VISIBLE box on the admin bar was this shared palette, which looks
   * through the person's own events, people and vendors. So the console had a
   * search bar and an assistant, and the one control on screen opened neither.
   * *A fix nobody can reach is no fix* — the third time this project has paid
   * for that exact shape.
   *
   * Default unchanged: hand in nothing and every other tree behaves as before.
   */
  searchSlot?: React.ReactNode;
  /** This surface's own create button — see `front-door-shell.tsx`. Passed straight through. */
  createSlot?: React.ReactNode;
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
  /** Where this tree stops being a phone — pure pass-through, see `shell-boundary.tsx`. */
  boundary?: ShellBoundary;
}) {
  const [account, navLabels, discoverOpen] = await Promise.all([
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
    // (The palette's index is no longer built here: the signed-in top bar has no search since 2026-10-22.)
    /*
      IS DISCOVER A DOOR HERE? In the app shell middleware bounces `/` to the
      board while it is in `APP_EXCLUDED_MARKETING_PATHS`, so the rail's first
      row — Discover — was a press that landed you where you stood (the
      designer found it on the iPad app, 2026-10-21). Asked once, on the server.
    */
    discoverOpensHere(),
  ]);

  return (
    <FrontDoorShell
      variant={variant}
      bleed={bleed}
      boundary={boundary}
      /*
        Only the public route group has full-bleed routes. The signed-in trees
        get `undefined` and pass `bleed` explicitly if they ever need it.
      */
      bleedPaths={variant === 'doorway' ? DOORWAY_BLEED_PATHS : undefined}
      account={account}
      navLabels={navLabels}
      /*
        🧭 NO TOOL LISTS (owner 2026-10-01, built 2026-10-23): the rail hands the
        shell no Planner · Builder · Together · Studio rows on any tree. Every
        tool is on /features (the rail's Features row); inside an event each one
        is a row of the event's own menu, built in the event layout.
      */
      railContext={railContext}
      contextMatchRows={contextMatchRows}
      focus={focus}
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
      createSlot={createSlot}
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
      /*
        🔍 2026-10-22 ("One thumb row", owner "Yes to all"): signed in, the top bar carries NO search — `false`, so
        the shell draws no box and no fallback. The search moved down into each list's thumb row
        (components/thumb-row.tsx), pointed at the place you stand in. Signed out is unchanged (the marketplace box).
      */
      search={searchSlot ?? (account.signedIn ? false : undefined)}
    >
      {/*
        🍎 WHERE DISCOVER DOES NOT OPEN, ITS RAIL ROW IS NOT DRAWN. This marker
        is the whole signal: `front-door.css` hides the row (and the divider
        under it) on a shell that contains it — `display: none`, so the row
        leaves the tab order and the accessibility tree too, not just the
        paint. Said from HERE, a server component, so the shell's client
        JavaScript — which the Maker's first load carries, at its ceiling on
        2026-10-21 — gains no byte. The account bar drops its Discover tab on
        the same answer (lib/account-bar.ts).
      */}
      {discoverOpen ? null : <span hidden data-discover-bounced="" />}
      {children}
    </FrontDoorShell>
  );
}
