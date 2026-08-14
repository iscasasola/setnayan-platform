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
 *   1 · Destinations   Home · Stories · Find a supplier (signed in only)
 *   2 · THE ACCOUNT SLOT  ← second, above the categories
 *   3 · Marketplace    the five visible folders + Show more (signed in only)
 *   4 · Studio         the seven tools
 *   5 · Small print    + a copyright line
 *
 * 🔑 THE ACCOUNT SLOT IS THE SECOND GROUP. Rev 1 had it third and asked the
 * owner where it belonged; the owner-supplied reference answered it. Signed
 * out it is the sign-in prompt, signed in it is the account's destinations —
 * ONE slot, two states. It never greys out and is never absent, which is what
 * makes it the page's single front-and-centre doorway.
 *
 * ⚠ MARKETPLACE IS SIGNED-IN ONLY (owner 2026-08-12), and "Find a supplier"
 * goes with it because it is the SAME destination under another word — hiding
 * a group while leaving its synonym in the list would defeat the instruction
 * with a label. Search still answers a signed-out person; that is deliberate
 * and is the one thing this page exists to solve.
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
import { activeRailKey, railMatchRows } from './rail-active';

/**
 * ─── THE SAME RAIL, MOUNTED IN TWO PLACES (One Shell slice 0, 2026-08-13) ──
 * Owner: *"the sidebar should stay… what you did was jumping back to the old
 * dashboards."* `DECISION_LOG.md` 2026-08-13. This component is GENERALIZED IN
 * PLACE rather than copied — a second rail would be a second answer to one
 * question, and the two would drift within a week.
 *
 *   variant="front-door"  `/` — top bar + search + off-canvas rail. Unchanged.
 *   variant="app"         a signed-in surface — THE RAIL ONLY, ≥1024 only.
 *
 * 🔑 WHY THE APP VARIANT RENDERS NO TOP BAR. The signed-in surfaces already
 * carry their own: the launcher's one-line rail holds the ⌘K command bar, the
 * notification bell and the account switcher, and its own docblock names those
 * as a REACHABILITY CONTRACT — sign-out exists nowhere else on that surface.
 * Replacing it with this page's top bar would swap a command palette over your
 * own events for a search box that goes to the supplier marketplace, and drop
 * two doors on the way. That is the orphaned-doorway bug class this repo keeps
 * re-learning. The rail is what the owner asked to stay; the rail is what
 * moves. It also matches the three shipped `SidebarShell` mounts, which are
 * likewise a rail beside a surface that keeps its own top chrome.
 *
 * ⚠ BELOW 1024 THE APP VARIANT RENDERS NO CHROME AT ALL. The phone's
 * bottom-bar grammar is locked, and a top bar plus a bottom bar is the double
 * render the plan names. There is no hamburger in this variant, so `railOpen`
 * can never become true, so the shipped `.fd-rail[data-open='false']
 * {display:none}` takes every row out of the tab order — a real mount
 * condition, not a style that looks like one.
 */

export type RailFolder = {
  slug: string;
  label: string;
  count: number;
};

export type RailTool = {
  href: string;
  name: string;
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
  variant?: 'front-door' | 'app';
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
}: Props) {
  const [railOpen, setRailOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const railId = useId();
  const { openSignIn, panel: signInPanel } = useSignInPanel();

  const inApp = variant === 'app';
  /**
   * The content column's TAG. See the long note at the element itself: on `/`
   * this column IS the page's main landmark; inside the app the host surface
   * already renders its own, so a second one here is a duplicated landmark on
   * every converted page. Capitalised because React reads a lowercase name as
   * a literal tag and this is a variable holding one.
   */
  const MainEl = inApp ? 'div' : 'main';
  const pathname = usePathname();

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

  return (
    // `data-chrome` is the ONE switch the stylesheet reads. Below 1024 the app
    // variant paints no chrome at all; the surface's own bars are untouched.
    <div className="fd" data-chrome={variant}>
      {inApp ? null : (
      <>
      <header className="fd-topbar">
        <div className="fd-topleft">
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
          <Link href="/" className="fd-wordmark">
            Setnayan
          </Link>
        </div>

        {/* The search keeps its own button and a mic beside it. A field with
            no button reads as decoration on a page whose job is to answer a
            word somebody typed. */}
        <div className="fd-searchwrap">
          <SearchBox />
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
              <Link href="/dashboard" className="fd-btn-gold">
                + Create
              </Link>
              {/* A real destination, not an ornament — /dashboard/notifications
                  ships. It was a handler-less button until the review. */}
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
              {menuOpen ? (
                <AccountMenu account={account} />
              ) : null}
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

      {/* Phone: the search gets its own row rather than squeezing the wordmark
          and the account cluster off the bar. */}
      <div className="fd-searchrow">
        <SearchBox />
      </div>
      </>
      )}

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
                {slotLabel(RAIL_SLOT.find, 'Find a supplier')}
              </span>
              <span className="fd-icon-caption">Find</span>
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
              <div className="fd-rlabel">Marketplace</div>
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
              {tools.map((t) => (
                <Link key={t.href} href={t.href} className="fd-row">
                  <span className="fd-dot" aria-hidden="true" />
                  <span className="fd-label-text">{t.name}</span>
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
        <MainEl className="fd-main" inert={railOpen ? true : undefined}>
          {/*
            ⚠ THE HIDDEN <h1> IS THE FRONT DOOR'S OWN, AND ONLY ITS OWN.
            `/` is a feed with no visible heading, so it carries one for
            screen readers and for search. Every account page already renders
            its own — rendering this one too would put TWO <h1>s on all ~15,
            which is the exact defect the doorway work measured and closed
            ("exactly one <h1> each", 2026-08-13). A shared shell must not
            bring the host page's headings with it.
          */}
          {inApp ? null : (
            <h1 className="fd-sr-only">Setnayan — plan your event, keep it for life</h1>
          )}
          <div className="fd-col">{children}</div>
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
