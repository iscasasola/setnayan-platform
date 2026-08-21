/**
 * Customer NavGroup[] builder — TWO LABELLED SECTIONS (design:
 * setnayan-overview-energy.html · 2026-07-10).
 *
 * The desktop sidebar is organised into two labelled sections matching the
 * couple energy prototype:
 *   PLAN    → Overview · Guests · Marketplace · Studio
 *   GO LIVE → Launch (the couple's live personal website)
 * EVERY top-level item is a PLAIN LEAF (owner 2026-07-15: "solid menu with no
 * submenus" — extends the vendor 5-page IA + the 2026-07-10 Overview/Guests
 * plain-leaf decision to the whole couple rail). No item expands children in the
 * rail; sub-navigation lives INSIDE each page (the Marketplace tab strip, the Studio
 * hub body). The PLAN / GO LIVE strings are flat SECTION HEADINGS, not
 * expandable parents. The mobile bottom nav (lib/customer-menu.ts) carries the
 * same top-level destinations + labels (Overview · Guests · Marketplace · Studio).
 *
 * PLAN items (all plain leaves):
 *   1. Overview → /dashboard/[id]         (its old checklist/schedule/messages/
 *      contracts children were flattened #3004; those surfaces live in the
 *      dashboard body + topbar). Renamed from "Home"; route + exact-match
 *      sentinel unchanged.
 *   2. Guests   → /dashboard/[id]/guests  (the guest-journey stages are
 *      integrated into the single Guests page) · guest-count badge.
 *   3. Marketplace → /dashboard/[id]/vendors (the Build/Budget/Compare tabs
 *      live in the page's own tab strip). Label lineage: Explore → Merkado →
 *      Marketplace; key + route unchanged throughout.
 *   4. Studio   → /dashboard/[id]/studio  (Event page · Website · Mood Board ·
 *      Monogram · Live Wall · E-Gifts all live in the Studio hub body — the App
 *      Store catalog rows + the hub's "Set up & manage" doorway block, NOT the
 *      rail — owner 2026-07-15 "no submenus")
 * GO LIVE items:
 *   5. Launch   → /website/editor (the unified editor) — gated on websiteEnabled.
 *
 * BUDGET removed 2026-07-10 (owner) — the standalone top-level Budget menu (and
 * its Activity + Disputes children) is GONE, matching the mobile SSOT
 * (lib/customer-menu.ts), which dropped it when the budget moved into the
 * Merkado (Vendors → Build · Budget · Compare). Reachability after removal:
 *   • /budget    → Merkado's Budget tab ("Open budget & payments" lens link).
 *   • /disputes  → the vendor booking cancel flow (cancel-booking-button → the
 *                  0023 § 3.6 dispute filing page at /disputes).
 *   • /activity  → the "See all recent activity →" link at the foot of the
 *                  dashboard body's "Around your event" section
 *                  (event-dashboard.tsx); the customer.sidebar.activity/disputes
 *                  registry slots are kept so a re-surfaced link stays
 *                  admin-editable.
 *
 * A non-empty `group.label` makes SidebarSection render a collapsible heading.
 * The 'plan'/'golive' group keys are stable (localStorage section-state).
 *
 * GUEST JOURNEY — the Guests item is a plain leaf (the five guest-journey stages
 * from lib/guest-journey — Build · Invite · Confirm · Seat · Day-of — now live
 * inside the single Guests page, not as sidebar children). `opts.dayOfOpen` is
 * retained as the day-of gating hook; defaults to false.
 *
 * HOME sentinel matchPrefix — `__home__` prevents the strict-prefix branch
 * from firing (every other /dashboard/[id]/... route shares the base prefix),
 * so only the exact pathname === href branch keeps Home lit.
 *
 * BOTTOM NAV: customer-bottom-nav.tsx reads from buildCustomerMenuTree
 * (lib/customer-menu.ts) — the SSOT for both the bottom nav and the docked
 * sub-nav. This sidebar builder and the bottom nav share the same five
 * destinations; active-match logic lives in customer-menu.ts.
 *
 * Server-Component safety (unchanged): neutral (non-'use client') module —
 * both the client sidebar and any Server Component can import + call this.
 */

import {
  Home,
  Users,
  Compass,
  Sparkles,
  Rocket,
  CalendarDays,
  Armchair,
  Wallet,
  Gift,
  Newspaper,
  Images,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { customerGuestsBadge } from '@/lib/nav-badges';
import { envFlagEnabled } from '@/lib/env-flag';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';

/**
 * Suite nav doorway (owner 2026-07-19: surface name locked = "Suite"; the nav
 * slot REPLACES Studio, flag-gated via NEXT_PUBLIC_SUITE — same flag that
 * un-404s /dashboard/[eventId]/suite). Flag ON → the Studio rail item renders
 * as Suite → `${base}/suite`; flag OFF → Studio exactly as today. The /studio
 * routes stay reachable either way (deep links + buy pages untouched) — only
 * the doorway swaps. Item KEY stays 'studio' (stable: hideKeys gating + the
 * customer.sidebar.studio registry slot key off it). NEXT_PUBLIC_* is inlined
 * into the client bundle at build time, so this neutral module reads the same
 * value on server + client (no hydration split). Mirror: lib/customer-menu.ts
 * (mobile SSOT) + lib/nav-registry-defaults.ts (registry label default).
 */
const SUITE_NAV_ON = envFlagEnabled(process.env.NEXT_PUBLIC_SUITE);

/**
 * Builds the canonical customer NavGroup[] for the given eventId — one
 * header-less group ('root', label: '') containing the 5 destinations that
 * match the mobile bottom-nav tabs. Each top-level item auto-expands on the
 * desktop sidebar to reveal its sub-pages.
 */
export function buildCustomerNavGroups(
  eventId: string,
  opts?: {
    dayOfOpen?: boolean;
    hideKeys?: string[];
    websiteEnabled?: boolean;
    monogramEnabled?: boolean;
    /** The event's public slug. Retained for callers/other consumers; the
     *  "Launch" entry no longer routes on it (owner 2026-07-24 — Launch opens
     *  the unified website editor, which links to the live
     *  `/[slug]` via "View my site"). */
    slug?: string | null;
    /** Live guest count → the Guests item's badge (neutral tone). Resolved
     *  server-side in layout.tsx; omit/0 → no badge (never fabricated). */
    guestCount?: number | null;
    /*
      THE EVENT LIFECYCLE PHASE — plan · dayof · after.

      🚨 THE DESKTOP RAIL HAD NO OPINION ABOUT WHETHER THE EVENT HAD HAPPENED.
      The phone's roster has swapped to Overview · Review · Editorial ·
      Galleries in the After phase since 2026-06-16 (`lib/customer-menu.ts`),
      and this SSOT — the one the desktop rail reads — never took the argument.
      So on a laptop a celebration that finished last month still led with
      "Plan", and the Editorial maker (the ONE thing there is left to do)
      appeared in no menu at all: it was reachable only through the Suite's
      website card or the /website hub.

      🔑 Owner, 2026-08-21, on a Movie Night that had already happened:
      *"why can i still plan and build and create guest list as if it hasn't
      ended."*

      OMITTED ⇒ 'plan' ⇒ BYTE-IDENTICAL to before, which is what keeps the
      existing callers (and their tests) honest.
    */
    phase?: MenuLifecyclePhase;
  },
): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  // The Guests head-count badge, built ONCE by the shared helper that the
  // phone's bottom bar also calls — see lib/nav-badges.ts for why the two must
  // not each derive it.
  const guestsBadge = customerGuestsBadge(opts?.guestCount);

  // Launch = the couple's website control surface. It lives in its OWN "Go live"
  // section (design: setnayan-overview-energy.html), not among the Plan items.
  // OPENS THE UNIFIED WEBSITE EDITOR (`/website/editor`) — owner
  // 2026-07-24 "when we open Launch, instead of the website, we start by the
  // settings (free) and the settings when Website Pro is unlocked". (Supersedes
  // the 2026-07-02 "open the live `/[slug]` directly" ruling; the live site is
  // now one click away via "View my site" on that surface.) Gated on the
  // 'website' surface (websiteEnabled). Design: Design_Launch_Settings_2026-07-24/.
  const launchItem: NavItem | null = opts?.websiteEnabled
    ? {
        key: 'launch',
        label: 'Launch',
        href: `${base}/website/editor`,
        icon: Rocket,
        matchPrefix: `${base}/website`,
      }
    : null;

  // PLAN section items — Overview · Guests · Marketplace · Studio · Budget. (Was the
  // single header-less 'root' group; split into labelled sections below.)
  const planItems: NavItem[] = [
        {
          // 1 · Home — event dashboard. Sentinel matchPrefix so the strict-
          // prefix branch never fires (every other route shares ${base}/).
          key: 'home',
          // Renamed Home → Overview (owner-approved product naming; matches the
          // design prototype). Route + exact-match sentinel unchanged.
          label: 'Overview',
          href: base,
          icon: SetnayanMark as unknown as LucideIcon,
          matchPrefix: '__home__',
          // Overview is a plain leaf — no sub-items (owner 2026-07-10: "the menu
          // does not need checklist, schedule, messages and contracts"). Those
          // surfaces stay reachable from the dashboard body + topbar: Schedule
          // from the dashboard's Schedule section, Checklist from its task cards,
          // Messages from the Conversations card + vendor cards + the topbar bell,
          // Contracts from the vendor itemization cards. "Refer a couple" (the
          // lone remaining child) came out too so the item reads as a clean leaf;
          // ⚠ CORRECTED 2026-08-18. This said "reachable via direct link /
          // account" and BOTH halves were false: the only account-menu link
          // lived in a component nobody mounts, so the sole way in was typing
          // the address. That sentence is what stopped anyone checking for a
          // month. The row is now in `alsoItems` above.
        },
        {
          // 2 · Guests — full guest hub, now a PLAIN LEAF (owner 2026-07-10:
          // the guest-journey stages Build·Invite·Confirm·Seat·Day-of·Event-QR
          // are integrated into the single Guests page — no sidebar submenu).
          // Mirrors the Overview leaf above. Seat (/seating) still opens from
          // within the Guests page; it stays in the mobile SSOT's activeMatch
          // (lib/customer-menu.ts) though the sidebar's single matchPrefix lights
          // only on /guests.
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
          // Guest-count badge — real head-count resolved in layout.tsx. 0/absent
          // → no badge (never fabricated). The phone's bottom bar renders the
          // IDENTICAL badge from the same helper.
          ...(guestsBadge ? { badge: guestsBadge } : {}),
        },
        {
          // 3 · Merkado — vendor marketplace. PLAIN LEAF (owner 2026-07-15:
          // "solid menu with no submenus"). The 5 Build tabs (Summary ·
          // Shortlist · Build · Compare · Lock) that used to expand here as
          // sidebar children now live ONLY as the page's own tab strip inside
          // /vendors (the docked <SubNav> pill / BB_TAB_EVENT bus is unchanged),
          // so tapping this row lands on /vendors and the in-page strip covers
          // the tabs. The single matchPrefix (${base}/vendors) keeps the item lit
          // on every ?tab= state (query-less prefix match).
          key: 'explore',
          // Label lineage: Explore → Merkado (2026-07) → Marketplace
          // (2026-07-27, owner: easier to understand). Key ('explore') + route
          // (/vendors) + matchPrefix unchanged throughout — links never break.
          label: 'Marketplace',
          href: `${base}/vendors`,
          icon: Compass,
          matchPrefix: `${base}/vendors`,
        },
        {
          // 4 · Studio — add-ons hub. PLAIN LEAF (owner 2026-07-15: "solid menu
          // with no submenus"). The design surfaces that used to expand here as
          // sidebar children (Event page · Website · Mood Board · Monogram · Live
          // Wall · E-Gifts) now live ONLY inside the Studio hub body: Mood Board
          // / Monogram / Website are App Store rows in "Browse everything"
          // (lib/add-ons-catalog.ts), and Event page / Live Wall / E-Gifts get an
          // explicit "Set up & manage" doorway block on the hub page
          // (studio/page.tsx) — added there because they aren't catalog SKUs, so
          // nothing orphans. matchPrefix (${base}/studio) keeps this lit on the
          // hub + /studio/* (mood-board, add-on detail); the disjoint surfaces
          // (/monogram, /live, /event-page, /pabuya, /site-editor) are their own
          // destinations reached from the hub body, same as the vendor 5-page IA.
          // SUITE SWAP (flag-gated, see SUITE_NAV_ON above): when on, this slot
          // is the Suite doorway → `${base}/suite`; matchPrefix follows the href
          // (a deep-linked /studio page then lights no rail item — matchPrefix is
          // a single prefix; the mobile tab still lights via its activeMatch
          // array in lib/customer-menu.ts).
          key: 'studio',
          label: SUITE_NAV_ON ? 'Suite' : 'Studio',
          href: SUITE_NAV_ON ? `${base}/suite` : `${base}/studio`,
          icon: Sparkles,
          matchPrefix: SUITE_NAV_ON ? `${base}/suite` : `${base}/studio`,
        },
        // (Launch moved OUT of the Plan items into its own "Go live" section —
        // see `launchItem` above + the two-group composition below.)
        // Budget top-level item REMOVED 2026-07-10 (owner) to match the mobile
        // SSOT (lib/customer-menu.ts): the budget now lives inside the Merkado
        // (Vendors → Build · Budget · Compare). /budget stays reachable from the
        // Merkado's Budget tab; /activity + /disputes from the dashboard body +
        // the vendor booking cancel→dispute flow. See the header docstring.
  ];

  // Two labelled sidebar sections (design: setnayan-overview-energy.html):
  //   PLAN    → Overview · Guests · Marketplace · Studio
  //   GO LIVE → Launch (the couple's live personal website)
  // Replaces the single header-less 'root' group. The Go-live section only
  // exists when Launch does (websiteEnabled) — an empty section would render a
  // heading with no rows.
  // "ALSO IN THIS EVENT" — the off-nav destinations the proto keeps as quiet
  // flat links (design: event_dashboard_v2_2026-07-15.html · the rail's "also
  // in this event" block). These are NOT top-level tabs (Schedule lives off the
  // rail by design; Seat plan + Budget live inside Guests / Merkado), but they
  // are real routes couples reach often, so the rail surfaces them as plain
  // links — flat, never a submenu (the whole-rail plain-leaf rule holds). Each
  // matchPrefix lights the row on its own route. Budget carries key 'budget' so
  // the Simple-Event `budget` hideKey drops it (same gate as the mobile SSOT).
  const alsoItems: NavItem[] = [
    /*
      🚨 PERSONALIZATION AND HOSTS HAD NO DOOR, AND THE OWNER FOUND IT BY
      LOOKING FOR ONE (2026-08-18). Both are real, live routes. The ONLY thing
      in the app that linked to either was `_components/profile-menu.tsx` — and
      that component is imported by NOTHING. It was superseded by the account
      switcher, which carries neither row. So for as long as that swap has been
      live, the only way to either page was to type the address.

      🔑 A LINK IN A COMPONENT NOBODY MOUNTS IS NOT A LINK. This is the
      gate-with-no-handle shape one level up: not a switch nobody can flip, but
      a PAGE nobody can reach. It survived because every check we have asks
      whether the route renders, and it does.

      ⚠ AND THE NAV REGISTRY STILL CLAIMS OTHERWISE — `nav-registry-defaults.ts`
      lists `customer.profile-menu.hosts` and `customer.profile-menu.personalization`
      under a `profile-menu` area that no longer ships. The register said the
      door was there; the app disagreed; nobody read both.

      They go HERE, beside Schedule and Seat plan, because this is where a person
      looks: it is the event's own list. The account menu is about YOU, and
      "put this celebration away" is about the EVENT.
    */
    {
      key: 'personalization',
      label: 'Personalization',
      href: `${base}/details`,
      icon: Sparkles,
      matchPrefix: `${base}/details`,
    },
    {
      key: 'hosts',
      label: 'Hosts',
      href: `${base}/hosts`,
      icon: Users,
      matchPrefix: `${base}/hosts`,
    },
    /*
      🚨 THE THIRD ROW FROM THE SAME DEAD MENU, added 2026-08-18 — the one the
      morning's fix missed. `profile-menu.tsx` carried FIVE links; Personalization
      and Hosts were restored and this was left behind, so an audit found it
      hours later still orphaned.

      🔑 A GUARD IS ONLY AS WIDE AS ITS LIST, and the list I wrote that morning
      had two entries because I had two examples in front of me. The check below
      it is now DERIVED from the dead component instead of typed by hand.

      ⏳ AND IT WAS NEVER CLICKABLE FOR A SINGLE DAY. The account switcher
      replaced that menu on 2026-06-17; this link was added to the already-dead
      menu on 2026-07-10 — three weeks AFTER it stopped rendering — and a
      changelog note the same day recorded the page as "reachable via direct
      link / account", which is what stopped anyone checking.

      🔒 KEYED 'refer' ON PURPOSE. The event layout already computes
      `navHideKeys` containing 'refer' whenever the referral programme is off,
      and filters by item KEY — but no item was keyed 'refer', so that gate has
      been hiding nothing while still costing a database read on every event
      page load. Giving the row this key makes the existing gate work as it was
      designed to, rather than adding a second one.
    */
    {
      key: 'refer',
      label: 'Refer a couple',
      href: `${base}/refer`,
      icon: Gift,
      matchPrefix: `${base}/refer`,
    },
    {
      key: 'schedule',
      label: 'Schedule',
      href: `${base}/schedule`,
      icon: CalendarDays,
      matchPrefix: `${base}/schedule`,
    },
    {
      key: 'seat',
      label: 'Seat plan',
      href: `${base}/seating`,
      icon: Armchair,
      matchPrefix: `${base}/seating`,
    },
    {
      key: 'budget',
      label: 'Budget',
      href: `${base}/budget`,
      icon: Wallet,
      matchPrefix: `${base}/budget`,
    },
  ];

  /*
    ─── AFTER THE EVENT, THE MAIN SECTION GAINS TWO ROWS AND A NEW NAME ─────

    The four rows the person already knows (Overview · Guests · Marketplace ·
    Suite) DO NOT MOVE — the owner asked to see a summary of exactly those,
    not to lose them, and taking a working row away from somebody mid-use is
    the failure this repo keeps paying for. Two rows JOIN them:

      · Editorial — the story maker. Its own destination has shipped since
        iteration 0046 and the phone's After roster has always listed it; the
        rail never did, so on a laptop the answer to "how do I open the
        editorial maker" was "through the Suite, through the website card,
        through a chip". Now it is a row.
      · Galleries — the photos, which are what the story is made of.

    Both are PLAIN LEAVES (whole-rail plain-leaf rule, owner-locked
    2026-07-15), and both routes already ship — nothing new is drawn here.

    🔒 THE ROUTES ARE THE SAME ONES `lib/customer-menu.ts` GIVES THE PHONE.
    Two rosters that name the same phase must not disagree about where it
    goes, and a second copy of these hrefs is how they would.
  */
  const afterItems: NavItem[] =
    opts?.phase === 'after'
      ? [
          {
            key: 'editorial',
            label: 'Editorial',
            href: `${base}/website/editorial`,
            icon: Newspaper,
            matchPrefix: `${base}/website/editorial`,
          },
          {
            key: 'galleries',
            label: 'Galleries',
            href: `${base}/galleries`,
            icon: Images,
            matchPrefix: `${base}/galleries`,
          },
        ]
      : [];

  // Two labelled sidebar sections (design: setnayan-overview-energy.html):
  //   PLAN    → Overview · Guests · Marketplace · Studio
  //   GO LIVE → Launch (the couple's live personal website)
  //   ALSO IN THIS EVENT → Personalization · Hosts · Schedule · Seat plan · Budget
  const groups: NavGroup[] = [
    {
      key: 'plan',
      // "Plan" is the wrong word for a celebration that has already happened.
      // The KEY stays 'plan' — the registry slots, the hideKeys gate and every
      // test key off it; only the word a person reads changes.
      label: opts?.phase === 'after' ? 'Your event' : 'Plan',
      defaultOpen: true,
      items: [...planItems, ...afterItems],
    },
    ...(launchItem
      ? [{ key: 'golive', label: 'Go live', defaultOpen: true, items: [launchItem] } as NavGroup]
      : []),
    { key: 'also', label: 'Also in this event', defaultOpen: true, items: alsoItems },
  ];

  // Per-event-type gating (e.g. a vendor-free Simple Event drops 'explore').
  // Empty/undefined hideKeys → unchanged for wedding + all existing types.
  // ('budget' is no longer a top-level item, so a 'budget' hideKey is a harmless
  // no-op — kept accepted for parity with the mobile tree, lib/customer-menu.ts.)
  if (!opts?.hideKeys?.length) return groups;
  const hide = new Set(opts.hideKeys);
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !hide.has(i.key)) }));
}
