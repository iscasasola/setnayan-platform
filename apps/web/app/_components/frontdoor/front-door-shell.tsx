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
import { useSignInHere } from '@/app/_components/auth/sign-in-here';

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
};

type Props = {
  account: FrontDoorAccount;
  visibleFolders: ReadonlyArray<RailFolder>;
  moreFolders: ReadonlyArray<RailFolder>;
  tools: ReadonlyArray<RailTool>;
  children: React.ReactNode;
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
}: Props) {
  const [railOpen, setRailOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const railId = useId();
  const signInHere = useSignInHere();

  /*
    SIGNING IN DOES NOT LEAVE THIS PAGE (Redesign Session 6, "the seam").
    Both Sign-in controls used to be <Link href="/login"> — a whole-page
    navigation that replaced the front door with a login screen and, on
    success, dropped the person on the account board. They never saw the one
    thing this rail is built to do: the sign-in prompt being replaced IN PLACE
    by their own destinations.

    ⚠ STILL A REAL LINK TO /login, deliberately — the press is intercepted
    only when the panel is actually mounted. A <button> would be a control that
    does nothing the day the provider moves, and it would break middle-click
    and open-in-new-tab, which people genuinely do with a sign-in. `prefetch`
    is off because the fallback page is rarely taken; there is no point
    fetching a route almost nobody will land on.
  */
  const openSignIn = (e: React.MouseEvent) => {
    if (!signInHere.available) return;
    e.preventDefault();
    signInHere.open();
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
    <div className="fd">
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
          <Link href="/" className="fd-wordmark">
            SETNAYAN
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
                onClick={openSignIn}
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
          {/* 1 · DESTINATIONS */}
          <Link href="/" className="fd-row" data-on="true">
            <span className="fd-gi" aria-hidden="true">
              ⌂
            </span>
            <span className="fd-label-text">Home</span>
            <span className="fd-icon-caption">Home</span>
          </Link>
          <Link href="/realstories" className="fd-row">
            <span className="fd-gi" aria-hidden="true">
              ◎
            </span>
            <span className="fd-label-text">Stories</span>
            <span className="fd-icon-caption">Stories</span>
          </Link>
          {account.signedIn ? (
            <Link href="/explore" className="fd-row">
              <span className="fd-gi" aria-hidden="true">
                ⌕
              </span>
              <span className="fd-label-text">Find a supplier</span>
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
              <Link href="/dashboard" className="fd-row">
                <span className="fd-gi" aria-hidden="true">
                  ←
                </span>
                <span className="fd-label-text">Back to your events</span>
                <span className="fd-icon-caption">Events</span>
                <Count value={account.eventCount} />
              </Link>
              <Link href="/dashboard/library" className="fd-row">
                <span className="fd-gi" aria-hidden="true">
                  ✧
                </span>
                <span className="fd-label-text">Alaala</span>
                <span className="fd-icon-caption">Alaala</span>
                <Count value={account.alaalaCount} />
              </Link>
              {/* People is deliberately off pending legal review. A NOTICE,
                  not a door — no chevron, no hover, nothing to press. */}
              <div className="fd-notice">
                <b>
                  People <span className="fd-soon">coming soon</span>
                </b>
                Family, godparents and friends together. Waiting on a legal
                review.
              </div>
              {account.shopName ? (
                <Link href="/vendor-dashboard" className="fd-row">
                  <span className="fd-gi" aria-hidden="true">
                    ▣
                  </span>
                  <span className="fd-label-text">{account.shopName}</span>
                  <span className="fd-icon-caption">Shop</span>
                  <span className="fd-ct">your shop</span>
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
                  onClick={openSignIn}
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

          {/* 3 · MARKETPLACE — signed-in only. */}
          {account.signedIn ? (
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
          ) : null}

          {/* 4 · STUDIO — the things you make. */}
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
        <main className="fd-main" inert={railOpen ? true : undefined}>
          <h1 className="fd-sr-only">Setnayan — plan your event, keep it for life</h1>
          <div className="fd-col">{children}</div>
        </main>
      </div>
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
