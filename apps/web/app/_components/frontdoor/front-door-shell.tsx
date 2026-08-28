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
 *   1 · Destinations   Home · Marketplace (signed in only)
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

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSignInPanel } from '@/app/_components/auth/sign-in-here';
import { SIGNED_IN_LANDING } from '@/lib/sign-in-landing';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';
import { LogoMark } from '@/app/_components/brand-marks';
import type { DemoOverlayId } from '@/lib/demo-overlay-bus';
import { activeRailKey, railMatchRows } from './rail-active';
import type { RailMatchRow } from './rail-active';
import { RailActiveKeyProvider } from './rail-active-key';
import { publicSearchPlaceholder } from '@/lib/public-search-nouns';
/*
  ─── THE RAIL'S OWN ROWS DRAW LUCIDE, LIKE EVERY OTHER ROW IN IT ──────────
  Until now they drew TYPOGRAPHIC CHARACTERS — ⌂ ◎ ⌕ ▦ ✧ ❖ ✎ ▣ ⛨ ▸ ⌃ ⌄ — while
  the rows that push in below (an event's sections, a shop's, the admin's) drew
  Lucide SVGs. `front-door.css` said so in writing: *"The rail's own rows use
  glyph characters; the app's nav rows use Lucide icons."* One list, two icon
  systems, and the seam fell in the middle of the account slot.

  🔑 A CHARACTER IS NOT AN ICON — IT IS A FONT LOOKUP, AND THE FONT DECIDES.
  These are Miscellaneous-Technical and Dingbat codepoints, not the Latin the
  UI font ships. Every one of them is resolved per platform:
    ⌂ U+2302 HOUSE           — absent from the Android system font
    ⛨ U+26E8 CROSS ON SHIELD — absent nearly everywhere; a tofu box □ on most
    ⌃ ⌄ U+2303/2304          — Mac modifier-key glyphs, thin coverage off macOS
    ✎ ✧ U+270E/U+2727        — in ranges a phone may hand to the EMOJI font,
                               which returns a colour picture at another weight
  Nothing throws when the lookup misses. The row keeps its label and its tap
  target, so the only symptom is a wrong-looking or empty square — the absence
  this project keeps paying for. An SVG has no font to miss: it draws the same
  strokes on a phone, a tablet and a desktop, in both themes.

  ⌕ U+2315 is TELEPHONE RECORDER. It sat in the Marketplace row for months
  doing duty as a magnifier. It is now `Compass`, which is what `customer-menu`
  has always given Explore — the app's own answer, not a second one.
*/
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Home,
  LayoutGrid,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
/*
  🔑 ONE ICON PER CATEGORY, FROM THE MAP THE APP ALREADY OWNS. The fifteen
  category rows drew the SAME arrow fifteen times while `WEDDING_FOLDER_ICON`
  — exhaustive over the taxonomy and pinned by `taxonomy-icons.test.ts` — was
  already drawing a distinct icon for each of them on the Explore strip. A
  second hand-typed map here is how a rail and a page start disagreeing about
  what "Venues & churches" looks like, so this imports the one that exists.
*/
import { folderIcon } from '@/lib/taxonomy-icons';

/**
 * How long the off-canvas drawer takes to slide, in milliseconds.
 *
 * It is the design system's `--sn-dur-control` (200ms, globals.css § motion) —
 * the tier for "a control changed state", which is what opening a drawer is.
 * Written as a number here because a `setTimeout` cannot read a CSS custom
 * property, and handed straight back to the stylesheet as `--fd-drawer-ms` on
 * the rail so the two halves of one animation can never disagree.
 */
const RAIL_DRAWER_MS = 200;

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
  // `year` is GONE with its rail row and its registry slot (owner 2026-08-21).
  // Leaving the key would point at a slot that no longer exists, so `slotLabel`
  // would fall through to its literal forever — a lookup that has quietly
  // stopped being a lookup, which is how the admin rename surface rots.
  find: 'customer.account.marketplace',
} as const;

type Props = {
  account: FrontDoorAccount;
  visibleFolders: ReadonlyArray<RailFolder>;
  moreFolders: ReadonlyArray<RailFolder>;
  tools: ReadonlyArray<RailTool>;
  children: React.ReactNode;
  /**
   * The page's ONE `<h1>`, when it has a real, visible one. Supplied ⇒ it is
   * rendered in place of the screen-reader-only fallback below — never
   * alongside it, which would put two `<h1>`s on the page.
   *
   * Exists because `/` had no visible headline at all: its heading was
   * `.fd-sr-only`, so the page opened on the chip bar and the card grid and
   * read as a bare feed. Any front-door surface that still has none keeps the
   * fallback and is unchanged.
   */
  heading?: React.ReactNode;
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
   * The `railContext` child's rows, as MATCH DATA — the other half of the one
   * list this component resolves.
   *
   * 🔑 IT ARRIVES AS DATA BECAUSE `railContext` ARRIVES AS A NODE. A rendered
   * child is opaque to its parent, so the shell cannot see which URLs the event
   * menu claims — and resolving without them is what forced the Studio rows to
   * stay unlit: on `/dashboard/<id>/seating/lab` this component would light
   * "3D Plan" while the child lit "Seat plan", and two lit rows tell the reader
   * they are in two places at once.
   *
   * The layout that builds the node builds this from the SAME inputs, so the
   * two cannot describe different menus. Absent ⇒ the union is just this
   * component's own rows, which is the correct reading for a rail with no
   * context pushed in.
   */
  contextMatchRows?: ReadonlyArray<RailMatchRow>;
  /**
   * Whether the person is standing inside one specific event right now —
   * true only on `/dashboard/[eventId]`. Owner 2026-08-22: *"marketplace is
   * best shown inside an event, not when they just logged in."* Gates the
   * Marketplace destination row and its "Browse by category" group, which
   * therefore no longer follows `railContext` — the admin console and the
   * vendor dashboard also push a `railContext`, and neither of those is a
   * reason to show a couple's supplier marketplace.
   *
   * Defaults to `false`: the front door, the My Events board, the admin
   * console and the vendor dashboard all render without it and stay exactly
   * as they were.
   */
  insideEvent?: boolean;
  /**
   * Admin-resolved labels, `getNavSlotMap()`.
   *
   * ⚠ APPLIED IN THE APP VARIANT ONLY, deliberately. On `/` the events row
   * reads "Back to your events" — a sentence chosen for someone standing
   * OUTSIDE their own app (see the row's own note below), not the registry's
   * "Events". That divergence already ships and is intentional; piping the
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
   * This surface's own primary "make something" button.
   *
   * 🔴 ADDED 2026-08-26, OWNER: *"this needs to change depending on where they
   * are. Home - Create Event. Shop - Create Service Card. HQ - Create what?"*
   * One hardcoded `+ Create event` was rendering on all six signed-in trees, so
   * **a supplier standing in their own Shop was offered a couple's wedding
   * wizard.** Not a matter of taste — a wrong button.
   *
   * THREE STATES, and the middle one is the reason this is not a boolean:
   *   · `undefined` — you said nothing, so the shell keeps `+ Create event`.
   *     Every existing caller is byte-identical.
   *   · a node   — your surface's own button.
   *   · `null`   — this surface makes nothing. HQ passes this: measured across
   *     every admin action ever recorded, only 9 of 65 created anything, and
   *     HQ's real primary action is the overdue pill already in that bar.
   *
   * 🔒 `.fd-btn-gold` is owner-locked (2026-08-14, one chrome one button
   * colour): a surface may change the WORDS and the destination, never the
   * treatment.
   */
  createSlot?: React.ReactNode;
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
  /**
   * Exact paths that should render full-bleed. Supplied by `AppRailShell` for
   * the doorway variant only.
   *
   * 🔑 THE SHELL LIVES IN A LAYOUT NOW, so a page cannot hand it `bleed` — the
   * layout renders above the page. The shell asks the router where it is
   * instead, DURING RENDER, so the right geometry is in the first byte of the
   * server HTML rather than corrected after paint.
   *
   * 🪤 WHOLE PATHS, NOT SEGMENTS. `useSelectedLayoutSegment()` returns the same
   * segment for `/explore` and `/explore/compare`, which silently made the
   * compare page full-bleed against its own design. See `shell-bleed.ts`.
   */
  bleedPaths?: readonly string[];
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

/**
 * The rail's icon slot — ONE component, so a row cannot pick its own size.
 *
 * 🔑 THE SIZE IS THE HALF THAT DRIFTS. Three sibling rails already render
 * Lucide into this same `.fd-gi` slot and two of them agreed on 18px while the
 * event rail drew 16px, so an event's sections came out a hair smaller than the
 * account rows directly above them in the SAME list. Nothing was wrong enough
 * to report and the whole column read as slightly unaligned. Every row on
 * every tree now goes through here.
 *
 * `strokeWidth` is pinned for the same reason: Lucide's default of 2 next to
 * the 1.75 the app's nav rows already use reads as two weights of icon.
 *
 * 🪤 THE CLASS IS A LITERAL AND MUST STAY ONE. `h-[${PX}px]` composed from a
 * constant looks tidier and is dead on arrival — Tailwind scans SOURCE TEXT,
 * so a class assembled at runtime is never generated, the rule never exists,
 * and the icon falls back to Lucide's own 24px with nothing to notice. The
 * same shape as every other "a sentence is not a mechanism" note in this repo.
 */
function RailIcon({
  as: Icon,
}: {
  as: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <span className="fd-gi" aria-hidden="true">
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

/**
 * One marketplace category row.
 *
 * Extracted from the single `folders.map` this file used to run, because the
 * five always-visible categories and the nine behind "Show more" now live in
 * two different places in the tree — the extra nine sit inside the `.fd-reveal`
 * panel that animates its own height. Two copies of the row would be two
 * answers to what a category row looks like, free to drift the first time one
 * of them gains a badge.
 *
 * ⚠ THE PARAMETER IS `f` ON PURPOSE, and renaming it breaks a shipped guard.
 * `rail-icons-are-icons.test.ts` pins the literal `folderIcon(f.slug)` — the
 * rule that a category row reads the shared taxonomy map instead of a
 * hand-typed one, so the rail and the Explore strip cannot start disagreeing
 * about what a category looks like. The extraction kept the name the map it
 * replaced already used, rather than widening a guard to fit a tidier word.
 */
function FolderRow({ f }: { f: RailFolder }) {
  return (
    <Link href={`/explore?folder=${encodeURIComponent(f.slug)}`} className="fd-row">
      <RailIcon as={folderIcon(f.slug)} />
      <span className="fd-label-text">{f.label}</span>
      <span className="fd-icon-caption">{f.label}</span>
      <span className="fd-ct fd-mono">{f.count}</span>
    </Link>
  );
}

export function FrontDoorShell({
  account,
  visibleFolders,
  moreFolders,
  tools,
  children,
  heading,
  variant = 'front-door',
  railContext,
  contextMatchRows,
  insideEvent = false,
  navLabels,
  topBarSlot,
  createSlot,
  search,
  bleed,
  bleedPaths,
}: Props) {
  const [railOpen, setRailOpen] = useState(false);
  /*
    ─── THE DRAWER HAS THREE STATES, NOT TWO ────────────────────────────────
    Owner 2026-08-21: the rail must animate when it opens and when it shuts.
    `display: none` cannot be transitioned, and the note on that rule in
    `front-door.css` explains why the usual workaround — leave it displayed and
    park it off-screen — is forbidden here: it would leave a dozen focusable
    links reachable by Tab behind the scrim. So the element is held for exactly
    one closing animation and then genuinely removed.
  */
  const [railClosing, setRailClosing] = useState(false);
  const railCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const railId = useId();

  const openRail = useCallback(() => {
    /* Re-opening mid-close must cancel the pending removal, or the drawer
       slides back in and is then torn out from under the hand that opened it. */
    if (railCloseTimer.current) {
      clearTimeout(railCloseTimer.current);
      railCloseTimer.current = null;
    }
    setRailClosing(false);
    setRailOpen(true);
  }, []);

  const closeRail = useCallback(() => {
    // Already closing — a second Escape must not queue a second timer.
    if (railCloseTimer.current) return;
    setRailClosing(true);
    railCloseTimer.current = setTimeout(() => {
      railCloseTimer.current = null;
      setRailClosing(false);
      setRailOpen(false);
    }, RAIL_DRAWER_MS);
  }, []);

  /* A drawer left closing while the shell unmounts would set state on a dead
     component. Cheap to clear, and it is the one leak a timer always has. */
  useEffect(
    () => () => {
      if (railCloseTimer.current) clearTimeout(railCloseTimer.current);
    },
    [],
  );
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
  const router = useRouter();
  /*
    ⚠ EXACT PATH MATCH, read during render so the class is server-rendered
    rather than applied in an effect after paint. `usePathname()` already
    excludes the query string, so `/explore?category=photo` still matches.
    An explicit `bleed` prop still wins, for the signed-in trees.
  */
  const isBleed = bleed || (bleedPaths?.includes(pathname ?? '') ?? false);

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
    The folder rows point at `/explore?folder=…`, which no route converted in
    this slice can reach, so they can never be the current page here. Telling
    them apart needs the current QUERY, and reading the query in a client
    component pulls in a Suspense contract this slice does not need.

    ✅ THE STUDIO ROWS ARE NOW IN — that debt is paid (2026-08-23). Inside an
    event they point at real in-app routes, so they CAN be the current page,
    and lighting them needed ONE resolver spanning this component and
    `EventRailContext`, which used to resolve its own rows independently. It
    does not any more: the event menu's rows arrive here as `contextMatchRows`,
    this call resolves the union, and the winner is published through
    `RailActiveKeyProvider` for the child to read. There is exactly one match
    list and exactly one resolver in the rail now.
  */
  const matchRows = [
    ...railMatchRows({
      signedIn: account.signedIn,
      hasShop: !!account.shopName,
      isAdmin: account.isAdmin,
    }),
    /*
      ─── THE STUDIO ROWS, LIT AT LAST (2026-08-23) ────────────────────────
      They were named debt above from 2026-08-21, when they started pointing
      at real in-app routes: lighting them here alone DOUBLE-LIGHTS against
      the event menu, which resolves in a component this one cannot see.
      `contextMatchRows` closes that — the two halves are now one list and one
      resolver, and the shipped specificity rule settles every overlap by
      itself. Measured, the whole overlap set is three URLs:
        /dashboard/<id>/seating/lab      3D Plan wins (its href is longer)
        /dashboard/<id>/website          Launch wins (it claims the family)
        /dashboard/<id>/website/editor   Launch wins (exact)

      🪤 A ROW POINTING AT THE PICKER IS NOT A DESTINATION. With two or more
      organiser events every Studio href collapses to `/dashboard` — the board
      that IS the picker — so eight rows would all match the events page and
      tie with the "Your events" row. They are dropped rather than ranked: a
      row that cannot be right is better left unlit than guessed, which is the
      rule this file already states for the marketplace folders.
    */
    ...tools
      .filter((t) => t.href !== '/dashboard')
      .map((t) => ({ key: t.key, href: t.href })),
    ...(contextMatchRows ?? []),
  ];
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
  /*
    ⚖ AND ON SUCCESS IT GOES TO EVENTS — owner 2026-08-28: *"when you log in,
    you should go directly to Events"*.

    🔑 THE OPTION IS PASSED HERE, NOT BUILT INTO THE PANEL. `SignInHerePanel` is
    shared: a shop page opens the same panel to retry a save the person had
    already pressed, and a guest page opens it mid-flow. Making the PANEL
    navigate would throw away the half-written enquiry the seam exists to keep —
    the one thing its own docblock forbids. Only the front door asks to leave.

    `router.push` runs before the panel's `router.refresh()`, which then
    re-renders the board it just navigated to.
  */
  const onSignInPress = (e: React.MouseEvent) => {
    e.preventDefault();
    openSignIn({ onSignedIn: () => router.push(SIGNED_IN_LANDING) });
  };

  // Escape closes whichever layer is open — the off-canvas rail first, since
  // it is the one that traps you.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (railOpen) closeRail();
      else if (menuOpen) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [railOpen, menuOpen, closeRail]);

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

  /*
    ⚠ THE EXTRA CATEGORIES ARE NO LONGER CONCATENATED IN AND OUT OF THE LIST.
    They render always, inside a `.fd-reveal` panel that animates its own
    height — a list that is rebuilt on every toggle has nothing to animate,
    because the rows the browser would tween are brand-new elements. The panel
    goes `visibility: hidden` at the end of the collapse, so the rows leave the
    tab order exactly as they did when they were unmounted.
  */

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
            onClick={() => (railOpen ? closeRail() : openRail())}
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
                (owner-locked 2026-08-14). `.fd-btn-gold` is the
                "+ Create event" treatment on both variants; do not restyle it
                per surface.

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
              {/*
                🔴 THE WORD "CREATE" STAYS IN THE LABEL. Owner 2026-08-15,
                hours after the href fix above: *"create button is gone."* It
                was not gone — it was RENAMED "+ New event" in the same commit
                that repointed it, and he scanned the bar for the word he knew
                and did not find it. The button he looks for is the word, not
                the position.

                🔑 A RENAME IS A REMOVAL TO WHOEVER WAS LOOKING FOR THE OLD
                NAME. The href was the only thing he asked to change; the label
                came along as an unrequested side effect and cost a round trip.
                "Create event" keeps his word AND stays honest about the one
                thing this button makes — which is why it is not reverted to
                the bare "+ Create" that used to point at the wrong page.
              */}
              {/*
                🔴 IT FOLLOWS THE SURFACE NOW (owner 2026-08-26). This one line
                rendered on all six signed-in trees, so a supplier in their own
                Shop was handed a couple's wedding wizard. `undefined` keeps
                exactly this button — every caller that says nothing is
                unchanged — a node replaces it, and `null` means this surface
                makes nothing.
              */}
              {createSlot === undefined ? (
                <Link href="/dashboard/create-event" className="fd-btn-gold">
                  + Create event
                </Link>
              ) : (
                createSlot
              )}
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
          ruling settled.

          🔴 IT RENDERS THE SAME CONTROL AS THE DESKTOP ROW, NOT A SECOND
          ANSWER. This line read `<SearchBox />` outright until 2026-08-16, so
          a doorway page — which hands in the palette — showed the palette at
          ≥701px and the MARKETPLACE FORM below it, because `.fd-searchwrap`
          is `display:none` on a phone and this row takes over. Measured live
          on all seven product doorways: two searches, one page, decided by
          how wide the window happened to be. The `?? <SearchBox />` fallback
          is the same one the desktop row uses, so a page that hands in
          nothing is byte-identical to before. */}
      {inApp ? null : (
        <div className="fd-searchrow">
          {search ?? <SearchBox />}
        </div>
      )}
      </>

      <div className="fd-body">
        {railOpen ? (
          <div
            className="fd-scrim"
            /* Fades out alongside the drawer rather than blinking away a step
               ahead of it — one event, not two. */
            data-closing={railClosing ? 'true' : 'false'}
            onClick={closeRail}
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
          data-open={railClosing ? 'closing' : railOpen ? 'true' : 'false'}
          /*
            🔑 ONE NUMBER, DECLARED ONCE. The stylesheet reads
            `var(--fd-drawer-ms)` and this component owns the timer that ends
            the closing state — handing the same constant to both is what stops
            them drifting into a drawer that vanishes mid-slide (CSS slower) or
            hangs half-open (CSS faster).
          */
          style={{ '--fd-drawer-ms': `${RAIL_DRAWER_MS}ms` } as React.CSSProperties}
        >
          {/* 1 · DESTINATIONS
              `data-on` comes from the resolver on every row. It was the string
              "true" on Home until 2026-08-13, which read correctly on the one
              URL this rail rendered on and would have lit Home on all 296
              pages the moment it rendered anywhere else. */}
          <Link href="/" {...rowProps('home')}>
            <RailIcon as={Home} />
            <span className="fd-label-text">Home</span>
            <span className="fd-icon-caption">Home</span>
          </Link>
          {/*
            STORIES IS NOT A DESTINATION ANY MORE — IT IS A CHIP (owner
            2026-08-20: *"what we want is the stories menu to be inside this as
            well"*).

            THE ROW WAS A SECOND DOOR TO THE SHELF DIRECTLY BELOW IT. The feed
            on this page and `/realstories` read the SAME three voices from the
            SAME loaders — featured chapters, consented showcases, the Journal
            — and the chip row over the feed already carried "Their stories".
            So the rail offered a menu item whose whole job was done by a
            button four inches to its right, and a person pressing it landed on
            the same pieces in different chrome. One shelf, one door.

            🔑 THE HUB IS NOT RETIRED AND MUST NOT BE ORPHANED. `/realstories`
            keeps its address (shared links, and it is where all storyteller
            SEO equity is concentrated by design), and it still carries what
            the chips do not: the event-type filter and the search box. Its one
            permanent link from this page is now the "Stories" SHELF HEADING in
            `front-door-feed.tsx`.
            ⚠ The other link on this page renders ONLY while the real-weddings
            grid is unearned — it is inside the written invitation that
            disappears the day the second couple publishes. Removing this row
            without promoting the heading would have left the hub with ZERO
            links from the front page on exactly the day it started to matter,
            which is the "a page nobody can reach" defect this project has
            already paid for. `front-door-invariants.test.ts` now fails if the
            heading link goes.
          */}
          {account.signedIn ? (
            insideEvent ? (
              <Link href="/explore" {...rowProps('find')}>
                <RailIcon as={Compass} />
                <span className="fd-label-text">
                  {/* Fallback MUST equal the registry's label for this slot
                      (`customer.account.marketplace` = "Marketplace"). They
                      diverged, and the same row read two different words on
                      two pages. `front-door-invariants.test` now pins them
                      equal. */}
                  {slotLabel(RAIL_SLOT.find, 'Marketplace')}
                </span>
                <span className="fd-icon-caption">Market</span>
              </Link>
            ) : null
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
                  {/* THE ARROW IS THE SENTENCE'S OTHER HALF. Outside the app
                      this row says "Back to your events" and points BACK; inside
                      it names the board. The icon has always followed the words
                      and still does — only the drawing changed. */}
                  <RailIcon as={inApp ? LayoutGrid : ArrowLeft} />
                  <span className="fd-label-text">
                    {inApp
                      ? slotLabel(RAIL_SLOT.events, 'Your events')
                      : 'Back to your events'}
                  </span>
                  <span className="fd-icon-caption">Events</span>
                  <Count value={account.eventCount} />
                </Link>
                <Link href="/dashboard/library" {...rowProps('alaala')}>
                  <RailIcon as={Sparkles} />
                  <span className="fd-label-text">
                    {slotLabel(RAIL_SLOT.alaala, 'Memories')}
                  </span>
                  <span className="fd-icon-caption">Memories</span>
                  <Count value={account.alaalaCount} />
                </Link>
                {/* YOUR YEAR — THE RAIL ROW IS RETIRED (owner 2026-08-21:
                    *"this is the your year concept integrated here. deleting
                    the your year menu"*).
                    Its premise expired. The row was added 2026-08-19 with the
                    reasoning "the home is becoming events-only, so the doorway
                    moves to the rail BEFORE the strip is removed" — and the
                    board then went the other way: the year's contents are now
                    the "Worth planning" SHELF on My Events, which is a bigger
                    door than this row ever was.
                    🔑 THE ROUTE IS NOT RETIRED, ONLY THE MENU. /dashboard/year
                    still holds the holidays the shelf leaves out, and the shelf
                    links to it in BOTH its branches — populated
                    (year-moments-list) and empty (year-moments-strip's
                    EmptyYear) — so the "a palette entry is not a doorway"
                    standard is still met, by a link a person can see rather
                    than a keyboard shortcut.
                    `lib/the-controls-have-a-home.test.ts` asserts exactly
                    that; do not re-add this row without changing it back. */}
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
                {/* ⚠ THIS SLOT HELD THE WORD "People" IN A CLASS THAT DOES NOT
                    EXIST. `.fd-icon` has no rule anywhere in front-door.css —
                    only `.fd-icon-caption` does — so the row rendered its icon
                    slot as unstyled body text and came out looking like a
                    SECTION HEADING, not a link. Every sibling row is
                    `fd-gi` glyph + `fd-label-text` label; this one silently
                    was not, and it had no visible label at all.

                    The owner read the rail and described it back as "People"
                    being a heading with "Your Story" inside it — which is
                    exactly what it looks like. The connections page was
                    reachable only by clicking something that does not appear
                    clickable. */}
                <RailIcon as={Users} />
                <span className="fd-label-text">People</span>
                <span className="fd-icon-caption">People</span>
              </Link>
              {/*
                YOUR STORY — THE RAIL ROW IS RETIRED (owner 2026-08-21: *"remove
                the your year and your story… we already have your story on
                untold"*).
                Its premise was "a thing you HAVE, not a thing you run, so it is
                never gated" — still true, and now served by the BOARD instead of
                a rail row.
                ⚠ CORRECTED 2026-08-22 — THOSE TWO LINKS NO LONGER GO HERE. My
                Events' "Untold" shelf now opens the EVENT'S OWN story page, and
                "Told" ends with *read them in Memories*. Both used to point at
                /dashboard/creator, and that is exactly what made the owner ask
                "isn't that the editorial. the story?" — a chapter is a person's
                own write-up ABOUT a day, the event's story page is Setnayan's
                write-up OF it. The account menu still carries "Your Story".
                🔑 THE ROUTE IS NOT RETIRED, ONLY THE MENU — do not delete
                /dashboard/creator, and do not re-add this row without changing
                `lib/the-controls-have-a-home.test.ts`, which now asserts the
                doors that replaced it.
              */}
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
                  <RailIcon as={Store} />
                  <span className="fd-label-text">{account.shopName}</span>
                  <span className="fd-icon-caption">Shop</span>
                  <span className="fd-ct">your shop</span>
                </Link>
              ) : null}
              {account.isAdmin ? (
                <Link href="/admin" {...rowProps('hq')}>
                  <RailIcon as={ShieldCheck} />
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
                <RailIcon as={Sparkles} />
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
          {/* The wrapper is the ANIMATION HOOK and nothing else — a block box
              inside a block rail, so no row moves by a pixel. `railContext` is
              a fragment of siblings; without one element to hang it on there is
              nothing for the arrival to animate. */}
          {railContext ? (
            /* The provider carries the ONE resolved key down to whatever the
               context group draws, so the child never resolves a second
               answer. See `rail-active-key.tsx` for why there is deliberately
               no fallback resolver on the other end. */
            <RailActiveKeyProvider activeKey={activeKey}>
              <div className="fd-rgroup">{railContext}</div>
            </RailActiveKeyProvider>
          ) : null}

          {/* 3 · MARKETPLACE — signed-in AND inside an event only (owner
              2026-08-22: *"marketplace is best shown inside an event, not
              when they just logged in"*). REVERSES the 2026-08-12 furniture
              rule below, which this replaces: the group used to show on the
              front door / My Events board and collapse away the moment a
              `railContext` pushed in (an event, the admin console, the
              vendor dashboard). `insideEvent` is narrower than `railContext`
              on purpose — the admin console and the vendor dashboard also
              push a context, and neither is a couple's supplier marketplace.

              🔄 STUDIO NO LONGER COLLAPSES WITH IT — see section 4. */}
          {account.signedIn ? (
            /*
              NESTED, NOT `&& insideEvent`, deliberately — same reasoning as
              before the reversal: the shipped guard pins this gate as the
              literal `{account.signedIn ?`, so folding a second condition
              into the same expression would blind it while reading as a
              tidier line. The collapse is a separate question, so it keeps
              its own branch.
            */
            insideEvent ? (
            <div className="fd-rgroup">
              <div className="fd-rdiv" />
              {/* NOT "Marketplace" — that is the row above, and the same word
                  twice in one rail reads as two different places. These are
                  shortcuts INTO it (`/explore?folder=…`). See the header. */}
              <div className="fd-rlabel">Browse by category</div>
              {visibleFolders.map((f) => (
                <FolderRow key={f.slug} f={f} />
              ))}
              {/*
                THE EXTRA CATEGORIES, ALWAYS RENDERED AND ANIMATED OPEN.
                `id` + `aria-controls` on the button below are what tell a
                screen reader which panel the press opened — the button used to
                rebuild the list around itself and announce nothing.
              */}
              <div
                id={`${railId}-more`}
                className="fd-reveal"
                data-open={moreOpen ? 'true' : 'false'}
              >
                <div className="fd-reveal-in">
                  {moreFolders.map((f) => (
                    <FolderRow key={f.slug} f={f} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="fd-row"
                aria-expanded={moreOpen}
                aria-controls={`${railId}-more`}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <RailIcon as={moreOpen ? ChevronUp : ChevronDown} />
                <span className="fd-label-text">
                  {moreOpen
                    ? 'Show fewer'
                    : `Show more — ${moreFolders.length} more`}
                </span>
                <span className="fd-icon-caption">More</span>
              </button>
            </div>
            ) : null
          ) : null}

          {/* 4 · STUDIO — the things you make. IT DOES NOT COLLAPSE.

              🔄 REVERSED 2026-08-21. Studio used to disappear the instant you
              opened a wedding, and the event's own menu carried a single row
              called Suite in its place. Owner, looking at both: *"this seem
              wrong since we lose the consistency of the concept. what we want
              is for that Studio to still show on the sidebar, but now it is
              link to that event."*

              🔑 THE PRODUCTS ARE THE CONCEPT, AND THEY ARE THE SAME PRODUCTS
              WHETHER YOU OWN ONE OR NONE. Hiding the group at the exact moment
              a person finally has somewhere to open it taught them the names
              only while they were a stranger. The rows still change behaviour
              — signed out they sell, signed in they open your own tools, and
              inside an event they open THAT event's — but the group itself is
              now furniture that never leaves.

              ⚠ THE MARKETPLACE STILL COLLAPSES. Fifteen supplier categories
              beside a wedding's sections is the list the drawing rejected;
              seven named products under one heading is not the same thing. */}
          <div className="fd-rgroup">
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
                  /* `data-on` is the style hook the stylesheet already reads and
                     `aria-current` is the half a screen reader gets — a rail
                     that only LOOKS right is only half right. Both come from
                     the one resolver, so they can never disagree. The
                     two-line variant keeps its own class. */
                  {...rowProps(t.key)}
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
          </div>

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
          event and vendor trees render `<main className="sn-vt-page">` — the
          element the phone's page-slide is named after. (Those two used to get
          it from `SidebarShell`; that component was deleted on 2026-08-15 and
          each layout carries the element itself.) Keeping this element a <main> in
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
          className={isBleed ? 'fd-main fd-bleed' : 'fd-main'}
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
          {/*
            🔑 A REAL HEADING REPLACES THE INVISIBLE ONE — it never joins it.
            `/` carried an `fd-sr-only` <h1> because it had no visible headline,
            which is exactly why the page read as a bare feed. A page that
            supplies `heading` renders THAT as its one <h1>; the fallback stays
            for any front-door surface that still has none. Two would break the
            "exactly one <h1> each" rule the doorway work closed 2026-08-13.
          */}
          {ownsHeading ? null : (heading ?? (
            <h1 className="fd-sr-only">Setnayan — plan your event, keep it together</h1>
          ))}
          <div className={isBleed ? 'fd-col fd-bleed' : 'fd-col'}>{children}</div>
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
 * It is a real GET form to `/` — the FRONT DOOR, which reads `?q=` and renders
 * the answer in its own body.
 *
 * ⚠ IT USED TO POST STRAIGHT TO `/explore`, AND THAT WAS THE DEFECT. Measured
 * on the live site 2026-08-20: `?q=doves` led with "No vendors match exactly.
 * Try widening your search or clearing one filter at a time." and put the
 * doves guide it had found underneath. A box promising "suppliers, stories and
 * guides" answered a story query with a failure about suppliers. Prod holds
 * two shops, so the marketplace could not lead well on anything.
 *
 * 🔒 THE WORD-BRIDGE IS NOT LOST AND IS NOT REBUILT HERE. Typing
 * "photographer" still reaches the folder we call Photo & video — through the
 * marketplace row the results page always carries, and through /explore's own
 * search box, which is untouched. What moved is which page answers FIRST.
 *
 * 🔑 ONE SEARCH, ONE PLACE THE ANSWERS APPEAR (owner 2026-08-20). The
 * signed-in palette's escape row lands on the same url this form does, so a
 * member and a stranger typing the same words reach the same page.
 *
 * ⚠ IT ANSWERS A SIGNED-OUT PERSON. The Marketplace GROUP is signed-in only,
 * but finding the one supplier you already need is not browsing a directory,
 * and cutting it would remove the single thing this page exists to solve.
 *
 * 🔑 THE PLACEHOLDER IS DERIVED, NOT TYPED. It read "Search suppliers, stories
 * and guides" from the day it shipped while /explore searched suppliers and
 * nothing else — two nouns with no code path behind them, for anyone who typed
 * an article title. /explore now also answers stories and guides (see
 * `lib/site-search.ts`), and these words are built from the same list the
 * resolvers are checked against (`lib/public-search-nouns.ts`), so the promise
 * and the mechanism cannot drift apart again without a red test.
 */
function SearchBox() {
  return (
    <form className="fd-searchbox" action="/" method="get" role="search">
      <input
        type="search"
        name="q"
        placeholder={publicSearchPlaceholder()}
        aria-label="Search Setnayan"
      />
      {/* SAME REASON AS THE RAIL ROWS ABOVE: this was ⌕ U+2315 TELEPHONE
          RECORDER doing duty as a magnifier, and it is the ONE control a
          signed-out visitor uses to search. A codepoint the font may not carry
          is a submit button that can render as an empty square. */}
      <button type="submit" className="fd-searchgo" aria-label="Search">
        <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
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
