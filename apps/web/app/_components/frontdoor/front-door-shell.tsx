'use client';

/**
 * front-door-shell.tsx — the top bar and the left rail.
 *
 * PORTED from `prototypes/front_door_and_seam_2026-08-12.html` (rev 3).
 *
 * ─── WHY THIS IS THE ONLY CLIENT COMPONENT ON THE PAGE ───────────────────
 * The hamburger, "Show more" and the account menu need state. The FEED does
 * not — it is 33 articles of server-rendered writing, and shipping it through
 * a client boundary would put the one thing carrying this page into the JS
 * bundle for no benefit. So the feed arrives as `children` (a server
 * component) and passes straight through.
 *
 * ─── THE RAIL'S FIVE GROUPS, IN ORDER ────────────────────────────────────
 *   1 · Destinations   Home · Stories · Marketplace (signed in only)
 *   2 · THE ACCOUNT SLOT  ← second, above the categories
 *   3 · Browse by category  the five visible folders + Show more (signed in
 *                           only) — the shortcuts INTO the Marketplace row
 *   4 · Studio         the seven tools
 *   5 · Small print    + a copyright line
 *
 * 🔑 THE ACCOUNT SLOT IS THE SECOND GROUP. Rev 1 had it third and asked the
 * owner where it belonged; the owner-supplied reference answered it. Signed
 * out it is the sign-in prompt, signed in it is the account's destinations —
 * ONE slot, two states. It never greys out and is never absent, which is what
 * makes it the page's single front-and-centre doorway.
 *
 * ⚠ MARKETPLACE IS SIGNED-IN ONLY (owner 2026-08-12): the destination row AND
 * the category group both go, because they are one destination — hiding the
 * group while leaving a second door to it in the list would defeat the
 * instruction with a label. Search still answers a signed-out person; that is
 * deliberate and is the one thing this page exists to solve.
 *
 * 🏷 ONE WORD, NOT THREE (owner 2026-08-15, asked directly: *"why do we have a
 * find a supplier. and sometime it is marketplace?"*). This row USED to read
 * "Find a supplier" here and "Marketplace" inside the app — because
 * `slotLabel` applies the nav registry in the `app` variant only, and the
 * registry's `customer.account.marketplace` slot has said "Marketplace" since
 * 2026-07-27 (owner: *"just use Marketplace so it is easier to understand"*).
 * So ONE row carried TWO words depending on which page you were standing on,
 * and a third heading below it carried the second word again. The fallback now
 * matches the registry, and the category group is titled by what it does.
 * 🔑 The binding prototype disagreed with ITSELF — `front_door_and_seam_
 * 2026-08-12.html` renders "Find a supplier" at line 851 while its own seam
 * note at line 1598 says *"Signed out it is called Marketplace on the front
 * door; signed in it is called Marketplace here. Same word, both sides."* The
 * port was faithful to the drawing and inherited the contradiction. **A
 * prototype is binding about COMPOSITION; where it contradicts its own written
 * intent, the intent is the decision.**
 *
 * NAMED COST, not a side effect: a crawler is always signed out, so those
 * category links leave the front page for Google too. The category pages stay
 * in the sitemap and keep working — the front page just stops pointing at
 * them.
 */

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSignInPanel } from '@/app/_components/auth/sign-in-here';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';
import { LogoMark } from '@/app/_components/brand-marks';
import type { DemoOverlayId } from '@/lib/demo-overlay-bus';
import { activeRailKey, railMatchRows } from './rail-active';

/**
 * ─── THE SAME RAIL, MOUNTED IN TWO PLACES (One Shell slice 0, 2026-08-13) ──
 * Owner: *"the sidebar should stay… what you did was jumping back to the old
 * dashboards."* `DECISION_LOG.md` 2026-08-13. This component is GENERALIZED IN
 * PLACE rather than copied — a second rail would be a second answer to one
 * question, and the two would drift within a week.
 *
 *   variant="front-door"  `/` — top bar + search + off-canvas rail. Unchanged.
 *   variant="app"         a signed-in surface — the rail (≥1024) AND, from
 *                         2026-08-14, THE SAME TOP BAR.
 *
 * ─── THE TOP BAR IS NOW SHARED TOO (owner 2026-08-14) ────────────────────
 * Owner, over three screenshots: *"the issue is the top nav is not there?"* —
 * the events board had a wordmark and a search box and no "+ Create", Alaala
 * had a wordmark and nothing else, and inside a wedding there was no wordmark
 * and no search at all. Three screens, three bars. One shell has to mean one
 * top bar, or the furniture still jumps as you move.
 *
 * 🔴 THIS FILE PREVIOUSLY ARGUED THE OPPOSITE, AND THE ARGUMENT WAS RIGHT AT
 * THE TIME. It said the app variant renders no top bar because each surface's
 * own bar is a REACHABILITY CONTRACT — the launcher's holds the ⌘K palette,
 * the notification bell and the account switcher, and sign-out exists nowhere
 * else on it — so swapping in this page's bar would trade a palette over your
 * own events for a search box aimed at the supplier marketplace and drop two
 * doors on the way. Every word of that still holds. What changed is that the
 * doors MOVED INTO the shared bar instead of being replaced by it:
 *
 *   `topBarSlot`  the host surface's OWN utility cluster, rendered verbatim —
 *                 its live bell (with its own notifications href), its account
 *                 switcher, and anything only it has (the event's unread chat,
 *                 the admin's SLA pill). Nothing is re-implemented here, so
 *                 nothing can be dropped in translation.
 *   `search`      the launcher's command palette, promoted to the shared
 *                 index. NOT this page's marketplace form — see below.
 *
 * 🔑 TWO SEARCHES, ONE QUESTION ANSWERED. The front door's box is a GET form
 * to /explore (the supplier marketplace); the launcher's ⌘K is a palette over
 * the person's own events. Inside the app, the palette is the correct one:
 * everything this variant wraps is a room in the person's own house, and a box
 * that answered "photographer" but not "Ana's wedding" would answer the wrong
 * question on all five surfaces. The palette carries the marketplace as an
 * escape row (`command-escape.ts`), so choosing it loses nothing; the reverse
 * was impossible, because a GET form cannot reach your own wedding.
 *
 * ⚠ WHAT THE APP VARIANT STILL PAINTS NOTHING OF BELOW 1024: the rail, and
 * the "+ Create" button. The phone's bottom-bar grammar is locked and there is
 * no room on a 360px row beside identity, search and the account cluster —
 * creation is reached from the board's create grid and the bottom bar. There
 * is no hamburger in this variant, so `railOpen` can never become true, so the
 * shipped `.fd-rail[data-open='false'] {display:none}` takes every row out of
 * the tab order — a real mount condition, not a style that looks like one.
 *
 * ⚠ AND WHAT IT DOES ADD TO A PHONE, DELIBERATELY: the identity link and the
 * search box, on the four trees that had neither. That is a departure from
 * "below 1024 the app variant paints no chrome", and it is the smaller of two
 * costs. Rendering the bar only at ≥1024 would mean each host keeps a second
 * bar for phones — so the live bell and the account switcher would mount
 * TWICE on every signed-in page, and `unread-bell-badge.tsx` carries a dated
 * comment about the crash that double-mount already caused once. The
 * alternative, hiding identity and search below 1024, deletes the launcher's
 * only one-press home on mobile (its own docblock calls that load-bearing)
 * and its phone search. One bar, one cluster, nothing mounted twice.
 */

export type RailFolder = {
  slug: string;
  label: string;
  count: number;
};

export type RailTool = {
  /** Stable id from `lib/studio-apps.ts`. Also the React key. */
  key: string;
  href: string;
  name: string;
  /**
   * The line under the name.
   *
   * SIGNED OUT it says what the product IS — owner 2026-08-14: *"that is where
   * we can talk about the different apps."* Seven bare names teach a stranger
   * nothing. The words come from `lib/studio-apps.ts`, the same record the
   * product page's own `<meta name="description">` reads.
   *
   * 🔑 SIGNED IN IT IS `null`, DELIBERATELY. The line's job changes from
   * selling to reporting, and we do not sell a person something they already
   * bought. Reporting honestly means a real count — and a count we have not
   * measured must render as NOTHING, never as 0, because filing an unmeasured
   * thing under "you have none" puts it in the one place a person has been told
   * they need not look. Resolving seven products' counts is seven reads on
   * every signed-in page render, so today the honest answer is silence. NAMED,
   * NOT FORGOTTEN: when a count can be read cheaply, it goes here.
   */
  line: string | null;
  /**
   * This product HAS a live demo — so the row wears a quiet "try it" marker.
   *
   * 🔄 IT NO LONGER OPENS ONE. Owner 2026-08-15: *"we still want a feature
   * description instead of directly just going to the demo."* For one day this
   * field made the row a <button> that threw a stranger straight into a
   * two-phone live demo before anything had said what the product was. The demo
   * lives on the product's own page now (`_doorway.tsx`'s `demo` prop) and the
   * page comes first.
   *
   * ⚠ ONLY SET WHERE AN OVERLAY ACTUALLY EXISTS (three of seven). The marker is
   * a promise that the page you land on can be tried, and a promise the page
   * cannot keep is the fake door this rail forbids.
   */
  demo?: DemoOverlayId;
};

export type FrontDoorAccount = {
  signedIn: boolean;
  /** Initials for the avatar. Never a name — the bar has no room for one. */
  initials: string;
  /**
   * THREE states, deliberately, because two would force a lie:
   *   number    → show it
   *   null      → we ASKED and the read FAILED ⇒ "couldn't load"
   *   undefined → we never asked ⇒ show NO count at all
   *
   * Collapsing the last two would print "couldn't load" on a row nothing had
   * tried to load, which is its own false statement — and collapsing either
   * into 0 is the failure this whole page is written against.
   */
  eventCount?: number | null;
  alaalaCount?: number | null;
  /** A vendor also gets a row straight into their own shop. */
  shopName: string | null;
  /**
   * An admin gets a row straight into HQ (owner 2026-08-13: "user home and shop
   * and admin will be on that sidebar"). Capability-gated like the shop row —
   * absent for everyone else, never a greyed row. Decided by THE canonical
   * predicate (lib/admin/admin-predicate.ts), which is three clauses wide:
   * is_internal · is_team_member · account_type === 'admin'. A narrower copy
   * once locked Team Pool staff out of a queue they were hired to work.
   */
  isAdmin: boolean;
  /**
   * Chapters this person has written, any status. Same three states as the
   * others: number → show it · null → we asked and the read FAILED · undefined
   * → never asked.
   *
   * ⚠ A REAL 0 IS SHOWN HERE, deliberately. Writing is open to everyone
   * ("creator = user", owner-locked 2026-07-16 — the apply/approve gate and the
   * is_creator flag were both dropped), so zero chapters is an empty desk you
   * own, not an absence of permission. The destination's own zero state is
   * already a written invitation.
   */
  storyChapterCount?: number | null;
};

/**
 * slot_key → the label an admin resolved for it, from `getNavSlotMap()`.
 *
 * ⚠ THE LABEL ONLY — `isHidden` is deliberately NOT read here. A first cut
 * dropped rows an admin had hidden, and that is a SECOND authority on which
 * rows exist: this rail's membership rule is capability ("does this
 * destination refuse a signed-in person?"), and two rules for one question is
 * how a row ends up present on the phone and absent on the desktop. It also
 * collided head-on with the shipped guard pinning the Find-a-supplier gate to
 * `account.signedIn` and its exact polarity — a guard written because that gate
 * had already been got wrong once. Nobody asked for hiding; labels were the ask.
 */
export type RailNavLabels = Record<string, { label: string }>;

/**
 * The nav-registry slots the rail's rows are named by.
 *
 * 🔑 RENDER LABELS THROUGH THE REGISTRY OR AN ADMIN RENAME APPLIES ON THE
 * PHONE AND NOT ON THE DESKTOP — two answers to one question, with no error.
 * The mobile navs already read these slots; the rail now reads the same ones.
 */
const RAIL_SLOT = {
  events: 'customer.account.events',
  alaala: 'customer.account.library',
  find: 'customer.account.marketplace',
} as const;

type Props = {
  account: FrontDoorAccount;
  visibleFolders: ReadonlyArray<RailFolder>;
  moreFolders: ReadonlyArray<RailFolder>;
  tools: ReadonlyArray<RailTool>;
  children: React.ReactNode;
  /** See the variant note in the file header. Defaults to the public page. */
  /**
   * `front-door`  `/` — top bar + search + off-canvas rail.
   * `app`         a signed-in surface — the rail (≥1024) and the shared bar.
   * `doorway`     a PUBLIC product page (/papic, /panood, …) — front-door
   *               chrome on a page that already owns its own <main> and <h1>.
   *
   * 🔑 THE THIRD VARIANT EXISTS BECAUSE THE OTHER TWO ARE EACH WRONG HERE IN A
   * DIFFERENT WAY, and both wrongs are silent:
   *   `app` would drop the hamburger — and the rail is `display:none` below
   *         1024, so a phone would get a product page with NO navigation at
   *         all — and would point the wordmark at /dashboard, which 307s to
   *         /login: a login trap for a stranger arriving from Google.
   *   `front-door` would bring a second <main> and a second <h1> to a page
   *         that already has both (`_doorway.tsx` renders them, and
   *         `doorway-invariants.test.ts` pins exactly one of each).
   */
  variant?: 'front-door' | 'app' | 'doorway';
  /**
   * The per-surface context group — "In this event", "Your people", a shop's
   * own menu. It PUSHES: everything above it stays exactly where it was, which
   * is the whole point of one shell. When it is present the Marketplace and
   * Studio groups collapse away, because those are front-page furniture (the
   * drawing does the same, `prototypes/one_shell_2026-08-13.html`).
   *
   * Slice 0 passes nothing — the account spokes have no sub-navigation. The
   * slot exists now so slice 1 mounts into it instead of re-opening this file.
   */
  railContext?: React.ReactNode;
  /**
   * Admin-resolved labels, `getNavSlotMap()`.
   *
   * ⚠ APPLIED IN THE APP VARIANT ONLY, deliberately. On `/` the events row
   * reads "Back to your events" — a sentence chosen for someone standing
   * OUTSIDE their own app (see the row's own note below), not the registry's
   * "My Events". That divergence already ships and is intentional; piping the
   * registry into the public page would silently revert it. Inside the app,
   * where the row is a plain destination, the registry wins.
   */
  navLabels?: RailNavLabels;
  /**
   * The host surface's OWN utility cluster, rendered verbatim at the right of
   * the shared bar — its live bell (each tree has a different notifications
   * inbox), its account switcher, and whatever only it has.
   *
   * 🔑 PASSED, NOT RE-IMPLEMENTED. The shell knows nothing about an admin's
   * SLA pill or an event's unread chat count, and a shared bar that rebuilt a
   * "standard" cluster would silently drop every control that exists on
   * exactly one surface — which is most of them. Handing the existing element
   * through is what makes "every door survives" a structural fact rather than
   * a promise somebody has to keep checking.
   *
   * ⚠ WHEN THIS IS PRESENT THE SHELL RENDERS NO BELL AND NO ACCOUNT MENU OF
   * ITS OWN. The slot carries both, and two account menus in one bar is two
   * answers to "where do I sign out".
   */
  topBarSlot?: React.ReactNode;
  /**
   * The search control. Defaults to the front door's marketplace GET form.
   * The app variant passes the command palette — see the file header for why
   * that is the one question worth answering inside the app.
   */
  search?: React.ReactNode;
  /**
   * Run the content column edge-to-edge inside the shell: no side gutters, no
   * 1600px cap. OPT-IN, and deliberately rare.
   *
   * 🔑 WHY IT EXISTS. The shared shell costs a converted page the rail's 240px
   * — that is the shell, and it is not negotiable. What IS negotiable is the
   * further 48px of `.fd-main` gutter and the `.fd-col` cap, and on the
   * supplier marketplace those two together are the difference between a grid
   * that fills the screen and one that lands at exactly 1152px on a 1440px
   * laptop — which is the `max-w-6xl` cap the owner explicitly struck out of
   * that page in PR #655. A reading page wants the cap; a browse surface the
   * owner has told us to "let maximize the full width" does not.
   *
   * ⚠ NOT A GENERAL ESCAPE HATCH. Every doorway that does NOT pass this keeps
   * the measured column, so adding it to a page is a decision that page's
   * content is a grid rather than prose. `front-door-geometry.test.ts` holds
   * both the base geometry and this override, so neither can drift into the
   * other.
   */
  bleed?: boolean;
};

/** A count that failed to load says so. It NEVER says 0, and it never invents
 *  a failure for a number nobody asked for. */
function Count({ value }: { value?: number | null }) {
  if (value === undefined) return null;
  if (value === null) {
    return <span className="fd-ct fd-unknown">couldn&rsquo;t load</span>;
  }
  return <span className="fd-ct fd-mono">{value}</span>;
}

export function FrontDoorShell({
  account,
  visibleFolders,
  moreFolders,
  tools,
  children,
  variant = 'front-door',
  railContext,
  navLabels,
  topBarSlot,
  search,
  bleed,
}: Props) {
  const [railOpen, setRailOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const railId = useId();
  const { openSignIn, panel: signInPanel } = useSignInPanel();

  const inApp = variant === 'app';
  /*
    FOUR QUESTIONS, ASKED BY NAME. `inApp` used to answer all of them at once,
    which was correct while there were two variants and silently wrong the
    moment there were three — every one of these differs for the doorway.
  */
  /** Does the HOST page already render the page's <main> and its <h1>? */
  const ownsMain = variant !== 'front-door';
  const ownsHeading = variant !== 'front-door';
  /** Is there an off-canvas rail to open below 1024? The app variant has none;
   *  a public page must, or a phone has no navigation. */
  const hasRailDrawer = variant !== 'app';
  /** Home means a different room depending on where you stand — but ONLY the
   *  signed-in app may point at /dashboard, which redirects a stranger to
   *  /login. */
  const homeHref = variant === 'app' ? '/dashboard' : '/';
  /** The stylesheet's one switch. A doorway wears the front door's chrome. */
  const chrome = variant === 'app' ? 'app' : 'front-door';
  /**
   * The content column's TAG. See the long note at the element itself: on `/`
   * this column IS the page's main landmark; inside the app the host surface
   * already renders its own, so a second one here is a duplicated landmark on
   * every converted page. Capitalised because React reads a lowercase name as
   * a literal tag and this is a variable holding one.
   */
  const MainEl = ownsMain ? 'div' : 'main';
  const pathname = usePathname();

  /*
    HIDE ON SCROLL — the app's universal top-nav rule (owner 2026-06-15), and
    the behaviour `SidebarShell`'s own sticky bar has given the event, vendor
    and admin trees since. Those trees hand their cluster to this bar now, so
    the bar has to keep the rule or scrolling a wedding suddenly pins a strip
    that used to slide away.

    ⚠ APP VARIANT ONLY. `/` is a marketing page whose bar is an approved
    prototype that stays put; changing it here would be a redraw of a signed-off
    design smuggled in as a shared-component change. The hook is passed
    `inApp`, so on the front door it never engages.
  */
  const barHidden = useHideOnScroll(inApp);

  /*
    WHICH ROW IS LIT — the whole reason this file changed.

    Every row that can ever be the current page is declared ONCE, in
    `railMatchRows` — not here, so the tests can call the real list instead of
    a copy of it — and the resolver picks the single most specific match. Rows
    are NOT asked "are you active?" one at a time, because the shipped matcher
    is prefix-based and `/dashboard` + `/dashboard/library` both answer yes.

    🪤 THE MARKETPLACE FOLDER ROWS AND THE STUDIO TOOLS ARE ABSENT ON PURPOSE.
    They point at `/explore?folder=…` and the eight public doorways — surfaces
    no route converted in this slice can reach, so they can never be the
    current page here and are never lit. Telling them apart from each other
    needs the current QUERY, and reading the query in a client component pulls
    in a Suspense contract this slice does not need. It arrives with the slice
    that converts `/explore`; until then a row that cannot be right is better
    left unlit than guessed. `activeRailKey` already accepts the params.
  */
  const matchRows = railMatchRows({
    signedIn: account.signedIn,
    hasShop: !!account.shopName,
    isAdmin: account.isAdmin,
  });
  const activeKey = activeRailKey(matchRows, pathname);
  /**
   * Everything that makes one row read as "you are here".
   *
   * `data-on` is the style hook the stylesheet already reads; `aria-current`
   * is the half a screen reader gets, and a rail that only looks right is only
   * half right. NEVER a literal on either — that is the bug this closes.
   *
   * Returned as props rather than written out per row so the two can never
   * disagree, and so each row stays one line: a shipped guard pins the string
   * `<Link href="/explore"` to catch the gate on that row being tampered with,
   * and splitting it across lines silently blinds that guard while looking
   * like formatting.
   */
  const rowProps = (key: string) => ({
    className: 'fd-row',
    'data-on': activeKey === key ? 'true' : 'false',
    'aria-current': activeKey === key ? ('page' as const) : undefined,
  });

  /**
   * A row's label: the admin's rename when there is one, the in-code word
   * otherwise. Front-door variant keeps its own deliberate copy (see the
   * `navLabels` note on Props).
   */
  const slotLabel = (slot: string, fallback: string) =>
    (inApp && navLabels?.[slot]?.label) || fallback;

  /*
    SIGNING IN DOES NOT LEAVE THIS PAGE (Redesign Session 6, "the seam").
    Both Sign-in controls used to be <Link href="/login"> — a whole-page
    navigation that replaced the front door with a login screen and, on
    success, dropped the person on the account board. They never saw the one
    thing this rail is built to do: the sign-in prompt being replaced IN PLACE
    by their own destinations.

    ⚠ STILL A REAL LINK TO /login, deliberately. A <button> pressed before
    hydration does NOTHING — a dead control, the one thing this page forbids —
    and it would break middle-click and open-in-new-tab, which people genuinely
    do with a sign-in. `aria-haspopup="dialog"` keeps that truthful to a screen
    reader: a link, that opens a dialog. `prefetch` is off because the fallback
    page is rarely taken.
  */
  const onSignInPress = (e: React.MouseEvent) => {
    e.preventDefault();
    openSignIn();
  };

  // Escape closes whichever layer is open — the off-canvas rail first, since
  // it is the one that traps you.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (railOpen) setRailOpen(false);
      else if (menuOpen) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [railOpen, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const folders = moreOpen
    ? [...visibleFolders, ...moreFolders]
    : visibleFolders;

  /*
    THE BAR, DEFINED ONCE. The app variant wraps it in the sticky
    `shell-topbar` box; the front door renders it directly as a child of `.fd`
    so its own `position: sticky` has the whole page to travel in.
  */
  const topBarEl = (
      <header className="fd-topbar">
        <div className="fd-topleft">
          {hasRailDrawer ? (
          <>
          {/*
            ⚠ ONLY WHERE THE RAIL IS ACTUALLY OFF-CANVAS (below 1024).
            It used to render at every width — so on a desktop it announced
            "Menu, collapsed" for navigation that was fully on screen, and
            pressing it mounted the scrim, whose only styles live inside the
            <1024 media query. Unstyled, the scrim became grid item #1 of
            `.fd-body` and shoved the rail and the feed into the wrong columns,
            collapsing the whole page layout.
            `fd-only-narrow` is a real CSS mount condition, not a visual one.
          */}
          <button
            type="button"
            className="fd-iconbtn fd-only-narrow"
            aria-label="Menu"
            aria-expanded={railOpen}
            aria-controls={railId}
            onClick={() => setRailOpen((v) => !v)}
          >
            ☰
          </button>
          </>
          ) : null}
          {/*
            🔒 THE TEXT IS TITLE-CASE "Setnayan" AND THE CAPITALS COME FROM CSS.
            It looks identical to the approved prototype — `.fd-wordmark` carries
            `text-transform: uppercase` — but the string in the HTML, in the
            accessible name, and in anything a reviewer or a screen reader reads
            now matches the OAuth consent-screen app name character for
            character.

            🚨 THIS IS NOT A STYLE PREFERENCE. Google refused Setnayan's OAuth
            brand verification on 2026-07-25, and one of the two stated reasons
            was that the ALL-CAPS wordmark did not read as a match for the app
            name. The page that fixed it (`HomeReskin`) rendered
            `<span class="hr-wordmark">Setnayan</span>` in title case with no
            transform — and `app/home-brand-name.test.ts` was written to hold
            that. When the front door replaced it in caps, the guard kept
            passing because it was still reading the retired file. Ported here
            with the page.
          */}
          {/*
            🔑 HOME MEANS A DIFFERENT ROOM DEPENDING ON WHERE YOU STAND.
            On `/` the wordmark is the marketing site's own home. Inside the
            app it is `/dashboard` — the launcher's docblock calls that "the
            only 1-click home; load-bearing on mobile, where no other surface
            renders a wordmark", and pointing it at `/` would eject somebody
            mid-task onto the marketing page. The rail's first row still goes
            to `/`, so the way out is not lost — it just is not the wordmark.
            Same control, same word, one destination each side of the seam.
          */}
          {/*
            🚨 THE TWO BRANCHES ARE NOT A TIDY-UP TARGET — THE FRONT DOOR'S
            MARKUP IS COMPLIANCE-PINNED. `home-brand-name.test.ts` asserts the
            literal `<Link className="fd-wordmark">Setnayan</Link>`, TEXT and
            title case, because Google refused Setnayan's OAuth brand
            verification on 2026-07-25 partly on "the app name on your consent
            screen does not match your homepage" — the page showed the glyph
            alone. Merging these into one element with a wrapping <span> turned
            that guard red within a minute of trying it. An image or an
            aria-label does not satisfy the requirement.

            🔑 THE APP BRANCH IS THE LAUNCHER'S OWN SHIPPED GRAMMAR, restored
            rather than dropped: `HomeRail` rendered a 28px mark on phones and
            the word from `sm` up, because at 375px the letterspaced wordmark
            takes ~90px before the search gets any — and this bar carries
            identity, search and the account cluster on ONE line (the second
            row being what the owner struck down on 2026-07-30). Same
            constraint, same answer.
          */}
          {/*
            🪤 THE APP BRANCH'S CLASS LIST IS `fd-wordmark fd-wordmark-app`,
            AND THE SECOND WORD IS LOad-BEARING FOR A GUARD, not for a style.
            `home-brand-name.test.ts` finds the front door's wordmark with
            `/className="fd-wordmark"\s*>\s*([^<]*?)\s*</` and reads the text
            inside it. With two elements carrying the bare class, that regex
            took the FIRST — this one — and read the empty string before
            `<LogoMark`, turning a correct front door red. Ordering the
            branches the other way would have "fixed" it by accident, which is
            the kind of pass this repo keeps paying for. A distinct class list
            makes the front door's match UNIQUE by construction, and the
            styling is unaffected because `.fd-wordmark` is still applied.
          */}
          {inApp ? (
            <Link href={homeHref} className="fd-wordmark fd-wordmark-app">
              <LogoMark size={28} className="fd-mark" />
              <span className="fd-wordmark-text">Setnayan</span>
            </Link>
          ) : (
            <Link href="/" className="fd-wordmark">
              Setnayan
            </Link>
          )}
        </div>

        {/* The search keeps its own button and a mic beside it. A field with
            no button reads as decoration on a page whose job is to answer a
            word somebody typed. */}
        <div className="fd-searchwrap">
          {search ?? <SearchBox />}
          {/*
            🪤 THE PROTOTYPE DRAWS A MIC HERE AND IT IS NOT PORTED, ON PURPOSE.
            There is no voice search in this product. A focusable, labelled
            button with no handler is a fake door in button form — worse than a
            dead link, because it looks like it did nothing rather than like it
            was never there. "No fake doors" is a LOCKED rule and it outranks a
            drawn affordance. Ship it when voice search exists.
          */}
        </div>

        <div className="fd-topright" ref={menuRef}>
          {account.signedIn ? (
            <>
              {/*
                🔒 ONE CHROME, ONE BUTTON COLOUR — GOLD EVERYWHERE
                (owner-locked 2026-08-14). `.fd-btn-gold` is the "+ Create"
                treatment on both variants; do not restyle it per surface.

                ⚠ HIDDEN BELOW 1024 in the app variant (CSS, not a branch).
                A 360px row already carries identity, the search and the
                account cluster; creation is reached from the board's create
                grid and from the bottom bar, which is the phone's locked
                grammar. Named, not forgotten.
              */}
              {/*
                🔴 IT NOW CREATES. Owner 2026-08-15: *"create should allow me to
                create an event."* It pointed at `/dashboard` — the events BOARD
                — which for somebody with exactly ONE upcoming event redirects
                straight back into that event, so the button landed you on the
                page you were already on.

                RULE 0: the flow already ships and THIRTEEN other controls
                already point at it (the ⌘K palette, the board's own create
                grid, the phone pill, Samahan, Alaala, Life-Flash, Year, three
                vendor-QR routes). Nothing was missing; one href was wrong.

                ⚠ SIGNED OUT, THIS BUTTON DOES NOT RENDER AT ALL — the rail
                shows the sign-in prompt instead — and that is the correct
                answer, not a gap. Pointing a stranger at an event-type picker
                they cannot submit would be a form behind a login wall.
              */}
              <Link href="/dashboard/create-event" className="fd-btn-gold">
                + New event
              </Link>
              {/*
                THE HOST'S OWN CLUSTER, OR THIS PAGE'S. When a surface hands
                one in, it carries that surface's live bell (pointed at ITS
                notifications inbox), its account switcher — which holds the
                only Sign out on that surface — and anything only it has. The
                shell renders NEITHER of its own alongside, because two bells
                and two account menus in one bar is the double-door defect
                wearing a tidy diff.
              */}
              {topBarSlot ?? (
                <>
                  {/* A real destination, not an ornament —
                      /dashboard/notifications ships. It was a handler-less
                      button until the review. */}
                  <Link
                    href="/dashboard/notifications"
                    className="fd-iconbtn"
                    aria-label="Notifications"
                  >
                    🔔
                  </Link>
                  <button
                    type="button"
                    className="fd-avatar"
                    aria-label="Your account"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    {account.initials}
                  </button>
                  {menuOpen ? <AccountMenu account={account} /> : null}
                </>
              )}
            </>
          ) : (
            <>
              {/* The drawn "⋮" overflow is not ported: it had no menu behind
                  it, and everything it would contain is already in the rail's
                  small print. Same rule as the mic. */}
              {/* Signing IN wears the app's terracotta, not this page's gold —
                  it is the first room inside, not the last step outside. That
                  is handled on the panel itself; here it is a quiet control so
                  the page never nags. */}
              <Link
                href="/login"
                prefetch={false}
                className="fd-btn-quiet"
                aria-haspopup="dialog"
                onClick={onSignInPress}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </header>
  );

  return (
    // `data-chrome` is the ONE switch the stylesheet reads. Below 1024 the app
    // variant paints no chrome at all; the surface's own bars are untouched.
    <div className="fd" data-chrome={chrome}>
      <>
      {/*
        🔑 `shell-topbar` IS A CONTRACT, NOT A CLASS NAME. Two shipped event
        pages hide the strip outright — the Guests page renders its own bar
        (`.shell-topbar{display:none}`) and the Vendors takeover hides it below
        1024 — by injecting a style rule that names exactly this word. It was
        `SidebarShell`'s hook and then `AdminStickyTopBar`'s; the shared bar
        inherits it with the job, or those two pages silently grow a second bar
        they deliberately removed.

        ⚠ IT IS THE WRAPPER, NOT THE BAR, AND THAT IS THE WHOLE POINT. A
        wrapper sets no `display` of its own, so `display:none` cannot lose a
        specificity tie to `.fd-topbar{display:grid}` — a fight whose outcome
        would otherwise depend on whether a page's injected <style> happens to
        come after the stylesheet. It also has to be the sticky box: sticky is
        constrained by its PARENT, so a header sticking inside a wrapper only
        as tall as itself has nowhere to travel and stops being sticky at all.
        Same shape `SidebarShell` and `AdminStickyTopBar` already use.
      */}
      {/*
        🔴 THE WRAPPER IS APP-VARIANT ONLY, AND THAT IS A BUG FIX.
        It rendered UNCONDITIONALLY when the shared bar shipped, so on the
        public front door `.fd-topbar` — `position: sticky; top: 0` — became the
        only child of a bare, unstyled <div> exactly its own height. STICKY IS
        CONSTRAINED BY ITS PARENT: with zero travel room the bar scrolled away
        with the page. Owner, 2026-08-15: *"top nav moves up with the main
        body."* Measured before the fix: parent 56px, bar 56px, travel room 0.

        🪤 THE NOTE BELOW HAD ALREADY WRITTEN THIS RULE DOWN — "it also has to
        be the sticky box: sticky is constrained by its PARENT, so a header
        sticking inside a wrapper only as tall as itself has nowhere to travel
        and stops being sticky at all." It was written FOR the app variant, and
        the same commit then introduced the defect on the other one. Knowing a
        rule and applying it to the branch in front of you are different acts.

        ⚠ THE BAR ITSELF IS DEFINED ONCE, ABOVE, AND ONLY THE WRAPPER IS
        CONDITIONAL. Writing the <header> out in both branches would be two
        copies of the app's only top bar, free to drift.
      */}
      {inApp ? (
        <div
          className="shell-topbar fd-topwrap"
          data-hidden={barHidden ? 'true' : 'false'}
        >
          {topBarEl}
        </div>
      ) : (
        topBarEl
      )}

      {/* Phone: the search gets its own row rather than squeezing the wordmark
          and the account cluster off the bar.

          ⚠ FRONT DOOR ONLY. Inside the app a second row IS the thing the owner
          rejected on 2026-07-30 — "the search bar is still on top" — after the
          launcher spent its two most valuable rows on chrome. The app variant
          keeps everything on ONE line at every width, which is what that
          ruling settled. */}
      {inApp ? null : (
        <div className="fd-searchrow">
          <SearchBox />
        </div>
      )}
      </>

      <div className="fd-body">
        {railOpen ? (
          <div
            className="fd-scrim"
            onClick={() => setRailOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <nav
          id={railId}
          className="fd-rail"
          aria-label="Sections"
          /*
            Below 1024 the rail is off-canvas and `data-open` drives
            `display:none` when it is shut.
            🔑 `display:none` is the point — it removes every row from the TAB
            ORDER. `aria-hidden` + `pointer-events:none` would leave a dozen
            focusable links sitting behind the scrim, which is the exact defect
            this project has already paid for once: a control that is invisible
            but still reachable by keyboard. Gate on a real condition, never on
            a style that only looks like one.
          */
          data-open={railOpen ? 'true' : 'false'}
        >
          {/* 1 · DESTINATIONS
              `data-on` comes from the resolver on every row. It was the string
              "true" on Home until 2026-08-13, which read correctly on the one
              URL this rail rendered on and would have lit Home on all 296
              pages the moment it rendered anywhere else. */}
          <Link href="/" {...rowProps('home')}>
            <span className="fd-gi" aria-hidden="true">
              ⌂
            </span>
            <span className="fd-label-text">Home</span>
            <span className="fd-icon-caption">Home</span>
          </Link>
          <Link href="/realstories" {...rowProps('stories')}>
            <span className="fd-gi" aria-hidden="true">
              ◎
            </span>
            <span className="fd-label-text">Stories</span>
            <span className="fd-icon-caption">Stories</span>
          </Link>
          {account.signedIn ? (
            <Link href="/explore" {...rowProps('find')}>
              <span className="fd-gi" aria-hidden="true">
                ⌕
              </span>
              <span className="fd-label-text">
                {/* Fallback MUST equal the registry's label for this slot
                    (`customer.account.marketplace` = "Marketplace"). They
                    diverged, and the same row read two different words on two
                    pages. `front-door-invariants.test` now pins them equal. */}
                {slotLabel(RAIL_SLOT.find, 'Marketplace')}
              </span>
              <span className="fd-icon-caption">Market</span>
            </Link>
          ) : null}

          <div className="fd-rdiv" />

          {/* 2 · THE ACCOUNT SLOT — second, above the categories. */}
          {account.signedIn ? (
            <>
              <div className="fd-rlabel">My Home</div>
              {/*
                🔑 "BACK TO YOUR EVENTS", NOT "EVENTS" — the seam's own words
                (`FRONT_DOOR_AND_SEAM_FINAL` §3.6). A signed-in person on the
                public site is a VISITOR HERE, not an ex-member: they pressed
                the wordmark to come out and read, and this row is the way
                back in. "Events" describes a list; "Back to your events"
                describes what pressing it does for someone who is standing
                outside their own app. Same destination, same count — the
                sentence is the whole change, and it is the reason the trip
                reads as a round trip rather than as two products.
              */}
              {/*
                🔑 THE ARROW AND THE SENTENCE ARE FOR PEOPLE STANDING OUTSIDE.
                "Back to your events" is the seam's own wording, and it is
                right on `/`: you pressed the wordmark, you came out to read,
                and this is the way back in. Inside the app it would be a lie —
                you are already in, there is nothing to go back to — so the app
                variant says what the row IS, under whatever name an admin has
                given it in the nav registry. Same href, same count.
              */}
              <Link href="/dashboard" {...rowProps('events')}>
                  <span className="fd-gi" aria-hidden="true">
                    {inApp ? '▦' : '←'}
                  </span>
                  <span className="fd-label-text">
                    {inApp
                      ? slotLabel(RAIL_SLOT.events, 'Your events')
                      : 'Back to your events'}
                  </span>
                  <span className="fd-icon-caption">Events</span>
                  <Count value={account.eventCount} />
                </Link>
                <Link href="/dashboard/library" {...rowProps('alaala')}>
                  <span className="fd-gi" aria-hidden="true">
                    ✧
                  </span>
                  <span className="fd-label-text">
                    {slotLabel(RAIL_SLOT.alaala, 'Alaala')}
                  </span>
                  <span className="fd-icon-caption">Alaala</span>
                  <Count value={account.alaalaCount} />
                </Link>
              {/*
                PEOPLE — A DOOR, NOT A NOTICE. This was a "coming soon · waiting
                on a legal review" notice, and it was WRONG ON BOTH HALVES.

                `/dashboard/people` ships, and its Samahan section WORKS TODAY —
                a person can create a group, invite by link and see its members
                right now. Telling them it is coming soon hides a feature they
                already own, on the one surface built to lead them to it.

                The legal half was wrong too. What is genuinely still to come is
                the CONNECTIONS half (family · godparents · friends), and the
                page's own copy already scopes the claim to exactly that — it
                was corrected there once before, for the same reason, after the
                wider sentence ("nothing to do on this page yet") was read by
                the owner and was false for anyone holding a samahan.

                🔑 A COMING-SOON LABEL IS A CLAIM ABOUT A WHOLE SURFACE. Scope
                it to the part that is unfinished, or delete it. Never let it
                cover a shipped feature standing beside the unfinished one.

                Owner, twice: "also people is not coming soon" and then, naming
                its contents, "where is the dependents, friends, ninong/ninang,
                samahan, family". He was reading this row when he said it.
              */}
              <Link href="/dashboard/people" {...rowProps('people')}>
                {/* PLAIN LABEL, DELIBERATELY. Every other account row reads
                    its label from the nav registry so an admin rename reaches
                    desktop and phone alike — but there is no
                    `customer.account.people` slot, and `slotLabel` FAILS OPEN
                    on a miss. Passing a key that does not exist would render
                    correctly forever while quietly never being renameable:
                    a reference that looks like a mechanism and is not.
                    Add the registry entry first, then switch this line. */}
                <span className="fd-icon" aria-hidden>
                  People
                </span>
                <span className="fd-icon-caption">People</span>
              </Link>
              {/*
                YOUR STORY — a thing you HAVE, not a thing you run, so it is
                never gated. Writing is open to every signed-in person; gating
                this row on "is a storyteller" (>=1 published chapter on a
                public profile) would hide a desk 8 of 9 accounts are entitled
                to sit at. Matches the shipped launcher, which shows the same
                href whether you have chapters or none.
              */}
              <Link href="/dashboard/creator" {...rowProps('story')}>
                <span className="fd-gi" aria-hidden="true">
                  ✎
                </span>
                <span className="fd-label-text">Your Story</span>
                <span className="fd-icon-caption">Story</span>
                {typeof account.storyChapterCount === 'number' ? (
                  <span className="fd-ct">{account.storyChapterCount}</span>
                ) : account.storyChapterCount === null ? (
                  <span className="fd-ct">couldn&apos;t load</span>
                ) : null}
              </Link>
              {/*
                WHAT YOU RUN — the second group, and the rule that decides
                membership is one sentence: does this destination REFUSE a
                signed-in person? No -> it is a desk you own, it lives above.
                Yes -> it is a console only some people hold, it lives here and
                renders only for the people the door admits.

                The label and divider render ONLY when a row follows. A heading
                over nothing is a fake door in label form.
              */}
              {account.shopName || account.isAdmin ? (
                <>
                  <div className="fd-rdiv" />
                  <div className="fd-rlabel">What you run</div>
                </>
              ) : null}
              {account.shopName ? (
                <Link href="/vendor-dashboard" {...rowProps('shop')}>
                  <span className="fd-gi" aria-hidden="true">
                    ▣
                  </span>
                  <span className="fd-label-text">{account.shopName}</span>
                  <span className="fd-icon-caption">Shop</span>
                  <span className="fd-ct">your shop</span>
                </Link>
              ) : null}
              {account.isAdmin ? (
                <Link href="/admin" {...rowProps('hq')}>
                  <span className="fd-gi" aria-hidden="true">
                    ⛨
                  </span>
                  <span className="fd-label-text">Setnayan HQ</span>
                  <span className="fd-icon-caption">HQ</span>
                  <span className="fd-ct">admin</span>
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <div className="fd-signin-prompt">
                <p>
                  Sign in to save suppliers, plan your event, and keep your
                  photos.
                </p>
                <Link
                  href="/login"
                  prefetch={false}
                  className="fd-btn-gold"
                  aria-haspopup="dialog"
                  onClick={onSignInPress}
                >
                  Sign in
                </Link>
              </div>
              <Link href="/alaala" className="fd-row">
                <span className="fd-gi" aria-hidden="true">
                  ✧
                </span>
                <span className="fd-label-text">What is Alaala?</span>
                <span className="fd-icon-caption">Alaala</span>
              </Link>
            </>
          )}

          {/*
            2b · THE CONTEXT GROUP — it PUSHES, it does not swap.
            Nothing above this line is removed when you go into an event or a
            shop: your own rows stay exactly where they were, which is the
            entire difference between one shell and two. Slice 0 passes
            nothing, so this renders nothing.
          */}
          {railContext}

          {/* 3 · MARKETPLACE — signed-in only.
              ⚠ MARKETPLACE AND STUDIO ARE FRONT-PAGE FURNITURE and collapse
              away whenever a context group is present, exactly as the drawing
              has it. A rail carrying a wedding's own sections AND fifteen
              supplier categories is a list, not a place. */}
          {account.signedIn ? (
            /*
              NESTED, NOT `&& !railContext`, deliberately. The shipped guard
              pins this gate as the literal `{account.signedIn ?` — it exists
              because the owner's signed-in-only rule was got wrong here once,
              and it also rejects an INVERTED gate. Folding a second condition
              into the same expression would have blinded it while reading as
              a tidier line. The collapse is a separate question, so it gets a
              separate branch.
            */
            railContext ? null : (
            <>
              <div className="fd-rdiv" />
              {/* NOT "Marketplace" — that is the row above, and the same word
                  twice in one rail reads as two different places. These are
                  shortcuts INTO it (`/explore?folder=…`). See the header. */}
              <div className="fd-rlabel">Browse by category</div>
              {folders.map((f) => (
                <Link
                  key={f.slug}
                  href={`/explore?folder=${encodeURIComponent(f.slug)}`}
                  className="fd-row"
                >
                  <span className="fd-gi" aria-hidden="true">
                    ▸
                  </span>
                  <span className="fd-label-text">{f.label}</span>
                  <span className="fd-icon-caption">{f.label}</span>
                  <span className="fd-ct fd-mono">{f.count}</span>
                </Link>
              ))}
              <button
                type="button"
                className="fd-row"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <span className="fd-gi" aria-hidden="true">
                  {moreOpen ? '⌃' : '⌄'}
                </span>
                <span className="fd-label-text">
                  {moreOpen
                    ? 'Show fewer'
                    : `Show more — ${moreFolders.length} more`}
                </span>
                <span className="fd-icon-caption">More</span>
              </button>
            </>
            )
          ) : null}

          {/* 4 · STUDIO — the things you make. Collapses with Marketplace. */}
          {railContext ? null : (
            <>
              <div className="fd-rdiv" />
              <div className="fd-rlabel">
                Studio <small>the things you make</small>
              </div>
              {/*
                EVERY ROW IS A LINK TO THE PRODUCT'S OWN PAGE — owner
                2026-08-15: *"we still want a feature description instead of
                directly just going to the demo."*

                🔄 THIS REVERSES YESTERDAY'S SHAPE, DELIBERATELY. Three rows
                were <button>s that opened the demo overlay in place. That
                answered "the side menu … will be able to show demo" too
                literally: pressing Papic threw a stranger straight into a
                two-phone live demo before anything had told them what Papic
                IS. The demo is still one press away — it lives on the product
                page itself (`_doorway.tsx`'s `demo` prop) — but the page comes
                first.

                So: seven rows, seven links, each carrying the line that says
                what the thing does. The three that have a demo keep a quiet
                marker so a stranger can see which ones are try-able before
                they commit a click.
              */}
              {tools.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className={t.line ? 'fd-row fd-row-2l' : 'fd-row'}
                >
                  <span className="fd-dot" aria-hidden="true" />
                  <span className="fd-toolwrap">
                    <span className="fd-label-text">
                      {t.name}
                      {/* A LABEL, NOT A VERB. "▸ demo" read as "this opens the
                          demo" and that is exactly what it must no longer do.
                          "try it" describes what the page you land on offers. */}
                      {t.demo ? (
                        <span className="fd-toolplay">try it</span>
                      ) : null}
                    </span>
                    {t.line ? <span className="fd-toolline">{t.line}</span> : null}
                  </span>
                  <span className="fd-icon-caption">{t.name}</span>
                </Link>
              ))}
            </>
          )}

          {/* 5 · SMALL PRINT.
              ⚠ "Contact us" does not exist — there is no /contact route, and a
              row that goes nowhere is the one thing this page forbids. It is
              Help, which exists, has search, and routes enquiries. */}
          <div className="fd-rdiv" />
          <div className="fd-smallprint">
            <Link href="/about">About</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/help">Help</Link>
            <Link href="/open-shop">Open your shop</Link>
            <br />
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/acceptable-use">Acceptable use</Link>
            <Link href="/cookies">Cookies</Link>
            <br />
            {/*
              🔴 THIS ROW EXISTS BECAUSE THE CONVERSION TOOK THE FOOTER AWAY AND
              NOBODY MEASURED IT. Leaving `NAV_ROUTES` also leaves
              `isMarketingRoute`, which is what `site-footer-chrome.tsx` gates
              on — so on 2026-08-15 the seven product doorways silently lost the
              shared footer along with the glass nav. Measured live afterwards:
              `/about` still ships a Download link and Cookie settings, `/papic`
              ships NEITHER.

              `href="/download"` exists in exactly two files app-wide, both
              gated by `isMarketingRoute` — so a converted page had NO ROUTE AT
              ALL to the download page. Same for Refunds. The rail is the only
              chrome those pages now have, so the rail has to carry them.

              ⚠ Cookie settings is a real control, not a link: the consent
              banner exposes a re-open handler and RA 10173 expects a standing
              way to change the choice. It is rendered by the host page's own
              banner, so this points at the page that hosts it.
            */}
            <Link href="/refunds">Refunds</Link>
            <Link href="/download">Download</Link>
            <Link href="/blog">Articles</Link>
            <Link href="/creators">For storytellers</Link>
            <Link href="/vendors">For suppliers</Link>
            <div className="fd-copy">© 2026 Setnayan</div>
            <div className="fd-tag2">Set na &rsquo;yan — that&rsquo;s all set.</div>
          </div>
        </nav>

        {/*
          `inert` while the drawer is open: without it, Tab walks straight out
          of the drawer and through every link in the feed BEHIND the scrim —
          the reader is typing into a page they cannot see. This is the same
          rule as the closed rail's `display:none`: gate on a real condition,
          never on something that merely looks like one.
        */}
        {/*
          🔑 A <main> ON THE FRONT DOOR, A <div> INSIDE THE APP — AND THE TAG
          IS THE WHOLE FIX.

          `/` is a page, so its content column is the page's `<main>` landmark.
          Every signed-in surface this shell wraps ALREADY RENDERS ITS OWN:
          `(launcher)` and `(account)` each wrap their children in one, and the
          event tree's `SidebarShell` renders the `.sn-vt-page` <main> that the
          phone's page-slide is named after. Keeping this element a <main> in
          the app variant therefore produced TWO <main> landmarks, nested, on
          every converted page — invalid HTML and a duplicated landmark for
          anyone navigating by landmark.

          ⚠ IT IS EXACTLY THE DEFECT THIS FILE ALREADY GUARDS AGAINST ONE LINE
          BELOW, in the other half: the sr-only <h1> is front-door-only so the
          shell does not bring a second heading to a host page that has one.
          The landmark needed the same rule and did not get it. The event
          layout's own docblock had also written it down — "Nesting a second
          <main> here produced two <main> elements in one tree" — for the
          wrapper INSIDE this one.

          Safe by measurement, not by hope: `.fd-main` has exactly one consumer
          (this line) and every style keys off the CLASS, so nothing moves.
        */}
        <MainEl
          className={bleed ? 'fd-main fd-bleed' : 'fd-main'}
          inert={railOpen ? true : undefined}
        >
          {/*
            ⚠ THE HIDDEN <h1> IS THE FRONT DOOR'S OWN, AND ONLY ITS OWN.
            `/` is a feed with no visible heading, so it carries one for
            screen readers and for search. Every account page already renders
            its own — rendering this one too would put TWO <h1>s on all ~15,
            which is the exact defect the doorway work measured and closed
            ("exactly one <h1> each", 2026-08-13). A shared shell must not
            bring the host page's headings with it.
          */}
          {ownsHeading ? null : (
            <h1 className="fd-sr-only">Setnayan — plan your event, keep it for life</h1>
          )}
          <div className={bleed ? 'fd-col fd-bleed' : 'fd-col'}>{children}</div>
        </MainEl>
      </div>
      {/* The sign-in panel, when it is open. It portals to <body>, so where it
          sits in this tree is irrelevant to layout — what matters is that it is
          rendered by a ROUTE component, so its code never enters the shared
          bundle. */}
      {signInPanel}
    </div>
  );
}

/**
 * The search field.
 *
 * It is a real GET form to `/explore`, which is where the shipped word-bridge
 * lives — typing "photographer" lands on the folder we call Photo & video,
 * with our word shown beside theirs as a place. That bridge is not rebuilt
 * here; this is its doorway.
 *
 * ⚠ IT ANSWERS A SIGNED-OUT PERSON. The Marketplace GROUP is signed-in only,
 * but finding the one supplier you already need is not browsing a directory,
 * and cutting it would remove the single thing this page exists to solve.
 */
function SearchBox() {
  return (
    <form className="fd-searchbox" action="/explore" method="get" role="search">
      <input
        type="search"
        name="q"
        placeholder="Search suppliers, stories and guides"
        aria-label="Search Setnayan"
      />
      <button type="submit" className="fd-searchgo" aria-label="Search">
        ⌕
      </button>
    </form>
  );
}

/**
 * The account menu.
 *
 * 🔒 SIGNING OUT LIVES HERE AND NOWHERE ELSE. Visiting the public site never
 * signs anyone out, and the fear that it might is exactly what stops members
 * from coming back to read — which matters a lot when the writing is what
 * carries this page.
 */
function AccountMenu({ account }: { account: FrontDoorAccount }) {
  return (
    <div className="fd-acctmenu" role="menu">
      <Link href="/dashboard" role="menuitem" className="fd-row">
        Your events
      </Link>
      <Link href="/dashboard/profile" role="menuitem" className="fd-row">
        Your account
      </Link>
      {account.shopName ? (
        <Link href="/vendor-dashboard" role="menuitem" className="fd-row">
          Your shop
        </Link>
      ) : null}
      <Link href="/dashboard/library?tab=photos" role="menuitem" className="fd-row">
        Your photos
      </Link>
      {/*
        ⚠ SIGN OUT IS A FORM, NOT A LINK, and that is not a style preference.
        `/auth/sign-out` is a POST-only route handler — a <Link> to it renders a
        row that answers 405, which is precisely the dead control this page
        forbids. It would also be prefetchable, i.e. a row that can sign you out
        by being NEAR the pointer.
      */}
      <form action="/auth/sign-out" method="post">
        <button type="submit" role="menuitem" className="fd-row">
          Sign out
        </button>
      </form>
    </div>
  );
}
