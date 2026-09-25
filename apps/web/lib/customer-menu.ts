/**
 * Customer menu — the SINGLE canonical hierarchy for the couple's nav.
 *
 * Owner direction 2026-06-17: *"sub nav are child menus of the 6 menus … we are
 * redesigning how the customer menu is."* There are SIX top menus (Home · Guests
 * · Explore · Studio · Design · Budget); each owns its CHILD MENUS, which surface
 * as the docked section sub-nav (mobile) and — in later phases — the desktop
 * sidebar groups. This module is that one tree, so the bottom nav, the docked
 * sub-nav, and the sidebar can never describe three different structures.
 *
 * Neutral module (no `'use client'`) — a Server Component (sidebar/bottom-nav,
 * later PRs) and the Client docked sub-nav can both import it; lucide icon refs
 * render in both contexts (the boundary issue was only ever the `'use client'`
 * wrapper, not the icons). Same pattern as `lib/guest-journey.ts`.
 *
 * Rollout (plan `adaptive-forging-lobster.md`): PR1 (this) builds the tree + the
 * generalized docked sub-nav for the two menus that already have children
 * (Guests, Explore). PR2/PR3 add children to Design/Budget then Home/Studio; PR4
 * points the desktop sidebar at this tree; PR5 folds phase-awareness in; PR6
 * links parent→child in the nav registry. So in PR1 only Guests + Explore carry
 * `children`; the other four are parents-without-children (the dock shows nothing
 * for them, exactly as today).
 *
 * TWO CHILD FLAVORS (the dock dispatches each differently):
 *   - `route`: a separate page. onSelect → router.push; active ← longest-prefix
 *     of the pathname over the child `match`. (Guests journey.)
 *   - `tab`:   an in-page panel on the parent's single route. onSelect →
 *     replaceState(?tab=) + the `BB_TAB_EVENT` bus; active ← `?tab=`. (Explore
 *     "Build" takeover.)
 *
 * MATCH vs SECTION-MATCH. `activeMatch` is the BROAD set that lights the bottom-nav
 * TAB (e.g. Guests also covers /event-qr + /hosts) — used by the bottom nav (PR4).
 * `sectionMatch` is the NARROWER set where the docked sub-nav SHOWS (the journey
 * proper: /guests* + /seating*; the takeover ROOT only: exactly /vendors). They
 * differ on purpose, so the dock keeps today's exact visibility.
 */

import {
  Home, Users, Compass, Sparkles, Palette, Gem, Globe, Camera, QrCode, Images,
  Newspaper, Wallet, Music, Crown, CalendarDays, Armchair, Box, Radio,
  Clapperboard, Grid2x2, Gift,
  type LucideIcon,
} from 'lucide-react';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { BUDGET_BUILD_TABS, TAB_META, tabLabel } from './budget-build';
import { isExploreReplanEnabled } from './explore-replan-flag';
import { SUITE_NAV_ON, studioHubHref } from './studio-hub';

/* The Suite doorway flag + href come from `lib/studio-hub.ts` — one branch,
   read by every surface (it used to be re-typed here). */

export type CustomerMenuKey =
  // Plan phase
  | 'home' | 'guests' | 'explore' | 'studio' | 'design' | 'budget'
  // Papic — a tab in every phase (owner 2026-09-24, "the life source")
  | 'papic'
  // Day-of phase
  | 'now' | 'checkin' | 'seats' | 'schedule'
  // After phase
  | 'review' | 'galleries'
  /* THE EVENT HUB — one key, one word, in ALL THREE phases (owner-locked
     vocabulary 2026-08-16: *Event Hub* = the one public address; design
     `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 1.2).
     🔒 THE KEY IS 'launch' AND IT DID NOT CHANGE. It is load-bearing in four
     places and three of them fail SILENTLY — the registry slot
     `customer.bottom-nav.launch`, the localStorage section-open state and the
     badge map. The retired 'services' (day-of) and 'editorial' (after) keys
     were the SAME slot wearing two other names; their registry defaults retire
     in this same commit, or /admin/menus keeps offering a rename for a row that
     no longer renders. */
  | 'launch';

export type MenuChildKind = 'route' | 'tab' | 'anchor';

export type CustomerMenuChild = {
  key: string;
  label: string;
  icon: LucideIcon;
  kind: MenuChildKind;
  /** kind='route' — destination + its active-state prefix (longest wins). */
  href?: string;
  match?: string;
  /** kind='tab' — the `?tab=` value driven over the BB_TAB_EVENT bus. */
  tab?: string;
  /** kind='anchor' — the id of an on-page section the dock scrolls to (and a
   *  scroll-spy lights as it enters view). For single-page menus whose children
   *  are scroll sections, not separate routes (e.g. Budget). */
  hash?: string;
  /** Rendered dimmed-but-tappable ("not yet", e.g. Day-of before its window). */
  muted?: boolean;
  /** Nav-registry slot key. When set, the docked sub-nav overlays the admin
   *  override (label · icon · hidden) from `/admin/menus` on top of these code
   *  defaults — so every sub-nav child is editable from the registry SSOT. */
  slotKey?: string;
};

export type CustomerMenu = {
  key: CustomerMenuKey;
  /** Fallback label/icon for surfaces that don't overlay the nav registry.
   *  The bottom nav + sidebar resolve label/icon from the registry (navSlots);
   *  these are the code defaults that mirror `customer-bottom-nav.tsx`. */
  label: string;
  icon: LucideIcon;
  href: string;
  /** BROAD active match — lights the bottom-nav TAB (consumed in PR4). Mirrors
   *  the specs in `customer-bottom-nav.tsx` verbatim. */
  activeMatch: string | string[];
  activeMatchExact?: boolean;
  /** NARROW match — where the docked sub-nav SHOWS. Omitted when the menu has no
   *  children (the dock then never shows for it). */
  sectionMatch?: string | string[];
  /** Exact-equal section match (no startsWith) — the takeover root only. */
  sectionMatchExact?: boolean;
  /** aria-label for the docked <SubNav>. */
  subnavLabel?: string;
  children?: CustomerMenuChild[];
};

export type CustomerMenuCtx = {
  /** Un-mutes the Guests "Day-of" stage once the live window is open. */
  dayOfOpen?: boolean;
  /** When set, overrides the returned tree with the phase-appropriate menus.
   *  Day-of and After menus have no children (the dock hides). */
  phase?: MenuLifecyclePhase;
  /** Top-level menu keys to drop for this event type, derived from its
   *  Event-Type Profile (e.g. ['explore','budget'] for a vendor-free Simple
   *  Event). Empty/undefined → every menu shows (wedding + all existing types
   *  byte-identical). Only filters the planning tree; the Day-of/After phase
   *  takeovers carry no explore/budget menu so they're unaffected. */
  hideKeys?: string[];
  /** Whether this event type enables the 'website' surface — gates the Studio
   *  "Launch" route child. Resolved from the profile in
   *  layout.tsx. Undefined/false → the child is omitted. */
  websiteEnabled?: boolean;
  /** Whether this event type enables the 'seating' surface — gates the DAY-OF
   *  "Seats" tab (owner 2026-08-28, "only its own rooms").
   *
   *  🔑 THIS CANNOT BE DONE WITH `hideKeys`, AND THAT IS THE WHOLE REASON THE
   *  FIELD EXISTS. `hideKeys` filters `planningMenus` at the very bottom of
   *  buildCustomerMenuTree; the day-of branch RETURNS BEFORE IT. Adding 'seats'
   *  to hideKeys would compile, read as correct, and hide nothing — a gate with
   *  no handle. (There is also no 'seats' key in the planning tree at all:
   *  seating lives inside Guests' activeMatch.)
   *
   *  ⚠ UNDEFINED MEANS SHOW, deliberately — a caller that has not been taught
   *  this field must not silently lose the tab. Only an explicit `false` hides
   *  it, and layout.tsx always passes the resolved value. */
  seatingEnabled?: boolean;
  /** The event's public slug, resolved from the event row in layout.tsx.
   *  NOTE: the "Launch" child no longer routes on it (2026-07-25 — Launch opens
   *  the unified website editor, which carries its own "View live" link); the
   *  field stays because callers pass it and future children may use it. */
  slug?: string | null;
  /** The event's Studio products as plain data — see `EventMenuCtx`. */
  studioRows?: EventMenuCtx['studioRows'];
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE EVENT MENU, BY MOMENT — ONE SECTIONED TREE (owner 2026-09-24)
   ═══════════════════════════════════════════════════════════════════════════

   Owner: *"realign what the sidebar of an event is and the bottom nav and
   hamburger menu on mobile mode so everything is easier to access by its flow.
   like finding the logo maker at the bottom feels so far."* Binding drawing:
   `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`.

   🔑 THERE WERE TWO TREES, AND THIS IS NOW THE ONLY ONE. The phone's bar read
   `buildCustomerMenuTree` (below); the desktop rail and the ☰ drawer read
   `buildCustomerNavGroups` (`customer-nav-config.ts`); and the shell drew
   "Browse by category" and a Studio group of its own on top of both. Every
   one of those now reads THIS function: `buildCustomerNavGroups` is a
   projection of these sections (icon NAMES → components), the phone bar picks
   its five tabs out of these rows by key, and the phone's moment strip is one
   of these sections. A third builder is the failure mode, not an option.

   THE SHAPE — one structure for every event type (owner: *"the other event
   will change accordingly. since wedding has all features"*):

     event   → Details (the event's name row; renamed from Personalization)
     spine   → Overview · Papic ✦ · Galleries · Editorial (after only) — no heading
     Book    → Your Team · Budget
     Look    → Mood Board ✦ · Logo Maker ✦ · Pakanta ✦
     Invite  → Guests · Hosts · Event Hub Controller
     The day → Schedule · Check-in (day-of only) · Seat plan ·
               Live Studio ✦ · Patiktok ✦
               (3D Plan ✦ is ABSORBED into Seat plan — see `STUDIO_ABSORBED`)
     end     → Setnayan AI ✦ · (any future product) · Suite · Refer a couple

   The existing event-type gating DROPS rows a kind lacks (hideKeys, the
   website/seating surfaces, and the product rows `railToolsSignedIn` already
   filtered through `addOnOfferedForEvent`); a section left empty is dropped,
   so its heading never renders over nothing.

   🔒 EVERY KEY IS THE KEY IT WAS. `home`, `guests`, `explore`, `studio`,
   `launch`, `budget`, `refer`, `personalization`, `seat`, `schedule`,
   `galleries`, `editorial`, `hosts` drive registry slots, localStorage state,
   badges and hideKeys, and every one of those fails SILENTLY on a rename. Only
   the words moved: Personalization→Details · All services→Suite. The phone's
   own words moved in the same pass (Now→Overview · Seats→Seat plan ·
   Review→Your Team), so one page has one word on every surface.
*/

/** An icon NAME. The tree carries names, never components: the product rows
 *  arrive from a SERVER layout, and a `LucideIcon` handed across the
 *  server→client boundary threw *"Functions cannot be passed directly to Client
 *  Components"* and took production down for ~7 hours on 2026-09-23. Each
 *  client surface resolves the name through `EVENT_MENU_ICONS` on its own side
 *  of the boundary — the `RailFocusIcon` pattern. */
export type EventMenuIconName =
  | 'overview' | 'papic' | 'galleries' | 'editorial'
  | 'team' | 'budget'
  | 'mood-board' | 'logo' | 'pakanta'
  | 'guests' | 'hosts' | 'hub'
  | 'schedule' | 'checkin' | 'seat' | 'plan3d' | 'live' | 'patiktok'
  | 'ai' | 'suite' | 'refer' | 'details' | 'product';

export const EVENT_MENU_ICONS: Record<EventMenuIconName, LucideIcon> = {
  overview: Home,
  papic: Camera,
  galleries: Images,
  editorial: Newspaper,
  team: Compass,
  budget: Wallet,
  'mood-board': Palette,
  logo: Gem,
  pakanta: Music,
  guests: Users,
  hosts: Crown,
  hub: Globe,
  schedule: CalendarDays,
  checkin: QrCode,
  seat: Armchair,
  plan3d: Box,
  live: Radio,
  patiktok: Clapperboard,
  ai: Sparkles,
  suite: Grid2x2,
  refer: Gift,
  details: Sparkles,
  product: Sparkles,
};

export type EventMenuRow = {
  key: string;
  label: string;
  href: string;
  icon: EventMenuIconName;
  /** Active-state prefix for the rail (defaults to `href`). */
  matchPrefix?: string;
  /** A Studio product — drawn with its ✦ at its moment, not under a heading. */
  studio?: boolean;
  /**
   * Further route families this row claims — the pages of a product ABSORBED
   * into it (see `STUDIO_ABSORBED`). Each lights THIS row on the rail and in
   * the moment strip, exactly as its `href` does. Plain strings: this crosses
   * no boundary as anything else.
   */
  alsoMatch?: string[];
};

export type EventMenuSectionKey = 'event' | 'spine' | 'book' | 'look' | 'invite' | 'day' | 'end';

export type EventMenuSection = {
  key: EventMenuSectionKey;
  /** '' = no heading (the event row, the spine and the end of the list). */
  label: string;
  rows: EventMenuRow[];
};

/** One Studio product row, as PLAIN DATA — exactly what `railToolsSignedIn`
 *  already returns (key · href · name), already gated for the event type. */
export type EventStudioRow = { key: string; href: string; name: string };

export type EventMenuCtx = {
  phase?: MenuLifecyclePhase;
  hideKeys?: string[];
  websiteEnabled?: boolean;
  /** ⚠ UNDEFINED MEANS SHOW — only an explicit `false` drops Seat plan. */
  seatingEnabled?: boolean;
  /**
   * The event's Studio products, from `railToolsSignedIn({eventId, count: 1,
   * profile})` in `layout.tsx`. Placed by KEY (see `STUDIO_PLACEMENT`).
   * Undefined → no product rows: this module is imported by client components
   * and must not pull the whole add-on catalogue into their bundle to guess.
   * `the-event-menu-is-one-tree.test.ts` fails if the layout stops passing it.
   */
  studioRows?: ReadonlyArray<EventStudioRow>;
};

/**
 * WHERE EACH STUDIO PRODUCT SITS (its icon here; its moment is its entry in
 * `SECTION_ORDER` below) — by key, so the Suite's catalogue stays the
 * one list of products and this stays the one list of moments.
 *
 *   papic                        → the spine, under Overview (owner 2026-09-24:
 *                                  *"papic is the life source of setnayan. it
 *                                  is where we collect photos and make
 *                                  memories"*)
 *   mood-board · palogo · pakanta → Look
 *   panood · patiktok             → The day
 *   pa3d                          → ABSORBED into Seat plan (`STUDIO_ABSORBED`)
 *   setnayan-ai                   → the end of the list
 *   pawebsite                     → DROPPED: the one-door ruling (2026-09-02)
 *                                  sends it to /launch, which Invite's Event
 *                                  Hub Controller row already opens
 *   __all__                       → DROPPED: the `studio` row IS the Suite row
 *   anything else                 → the END, so a future product is never
 *                                  silently lost
 */
const STUDIO_PLACEMENT: Record<string, EventMenuIconName | 'drop'> = {
  papic: 'papic',
  'mood-board': 'mood-board',
  palogo: 'logo',
  pakanta: 'pakanta',
  pa3d: 'plan3d',
  panood: 'live',
  patiktok: 'patiktok',
  'setnayan-ai': 'ai',
  pawebsite: 'drop',
  __all__: 'drop',
};

/**
 * ─── A PRODUCT ABSORBED INTO A ROW (owner 2026-09-24) ─────────────────────
 * Owner, on the new menu: *"seat plan also show 3D plan? so i think we can
 * remove the 3D Plan menu. since the 3D version is on the seatplan already.
 * but make sure mapping stay consistent"*.
 *
 * The 3D Plan row opened `/seating/lab` — the SAME page Seat plan's own
 * `List | 2D | 3D` segment opens (`SeatingViewSegment`), and the lab links on
 * to the 3D Plan control centre (`/plan3d`). So the product row was a second
 * door to a view of the seat plan. It is not drawn; its pages are CLAIMED by
 * the host row instead, so `/seating/lab` and `/plan3d` light **Seat plan** on
 * the rail and in the phone's moment strip, exactly as `/seating` does.
 *
 * 🔒 THE KEY STAYS `pa3d`. It is still in `railToolsSignedIn` (the Suite
 * parity count), still in `SECTION_ORDER.day` (its fallback slot) and still in
 * `STUDIO_PLACEMENT` (its icon) — nothing that keys off it is renamed.
 *
 * ⚠ THIS IS NOT A DROP. If the host row is absent while the product is offered
 * (today impossible: both ride the `seating` surface — `seatingEnabled` is
 * `surfaceEnabled(profile, 'seating')` and pa3d's catalogue `surface` is
 * `'seating'`), the product row stands in its own slot rather than vanishing.
 */
export const STUDIO_ABSORBED: Readonly<
  Record<string, { into: string; routes: (base: string) => string[] }>
> = {
  pa3d: { into: 'seat', routes: (base) => [`${base}/seating/lab`, `${base}/plan3d`] },
  /* 🛠 THE LOGO MAKER LIVES IN THE EVENT HUB MAKER (owner 2026-09-24/25: "the
     logo maker lives in the editor"; one sidebar row "Event Hub Maker"). Its
     door is the Maker bar's "Logo"; `/monogram` lights the Maker row. Same rule
     as pa3d: with no Maker row (no Event Hub for this kind) it keeps its own. */
  palogo: { into: 'launch', routes: (base) => [`${base}/monogram`] },
};

/** Every path a row claims: its href, its `matchPrefix`, its `alsoMatch`. */
export function eventMenuRowClaims(r: EventMenuRow): string[] {
  return [r.href.split('?')[0]!, r.matchPrefix, ...(r.alsoMatch ?? [])].filter(
    (m): m is string => !!m && m !== '__home__',
  );
}

/**
 * The order each moment reads in — and, for a product, WHICH moment: a
 * product key listed here is placed; one listed nowhere goes to `__unknown__`
 * at the end. (One list decides placement. A second `section` field beside it
 * was tried and was decorative — moving Logo Maker there changed nothing.)
 * Keys absent from the tree are skipped.
 */
const SECTION_ORDER: Record<Exclude<EventMenuSectionKey, 'event'>, string[]> = {
  spine: ['home', 'papic', 'galleries', 'editorial'],
  book: ['explore', 'budget'],
  look: ['mood-board', 'palogo', 'pakanta'],
  invite: ['guests', 'hosts', 'launch'],
  day: ['schedule', 'checkin', 'seat', 'pa3d', 'panood', 'patiktok'],
  end: ['setnayan-ai', '__unknown__', 'studio', 'refer'],
};

const SECTION_LABEL: Record<EventMenuSectionKey, string> = {
  event: '',
  spine: '',
  book: 'Book',
  look: 'Look',
  invite: 'Invite',
  day: 'The day',
  end: '',
};

/**
 * THE tree. Every event-menu surface reads this — see the block above.
 */
export function buildEventMenuSections(
  eventId: string,
  ctx: EventMenuCtx = {},
): EventMenuSection[] {
  const base = `/dashboard/${eventId}`;
  const phase = ctx.phase ?? 'plan';
  const hide = new Set(ctx.hideKeys ?? []);

  const rows = new Map<string, EventMenuRow>();
  const put = (r: EventMenuRow) => rows.set(r.key, r);

  put({ key: 'personalization', label: 'Details', href: `${base}/details`, icon: 'details' });
  // Sentinel matchPrefix: every other event route shares `${base}/`, so only
  // the exact pathname === href branch may light Overview.
  put({ key: 'home', label: 'Overview', href: base, icon: 'overview', matchPrefix: '__home__' });
  // Galleries in EVERY phase, directly under Papic: it is where Papic's photos
  // land, and the page already says "collecting" before the first one.
  put({ key: 'galleries', label: 'Galleries', href: `${base}/galleries`, icon: 'galleries' });
  // 🛠 Editorial's door is the Event Hub Maker's "Post Event" (owner
  // 2026-09-25: one row, "Event Hub Maker", holding Logo Maker · Editorial ·
  // Love Story). It keeps its own row only where there is no Maker to hold it.
  if (phase === 'after' && !ctx.websiteEnabled) {
    put({ key: 'editorial', label: 'Editorial', href: `${base}/story`, icon: 'editorial' });
  }
  put({ key: 'explore', label: 'Your Team', href: `${base}/vendors`, icon: 'team' });
  put({ key: 'budget', label: 'Budget', href: `${base}/budget`, icon: 'budget' });
  put({ key: 'guests', label: 'Guests', href: `${base}/guests`, icon: 'guests' });
  put({ key: 'hosts', label: 'Hosts', href: `${base}/hosts`, icon: 'hosts' });
  // THE EVENT HUB CONTROLLER — one row, one word, every phase. Gated on the
  // website surface on the rail AND the phone alike (the two used to disagree
  // for the day-of and after bars). `matchPrefix` claims the /website family:
  // the editor and Editorial maker are this controller's own doors.
  // ✏️ 2026-09-25: THE EVENT HUB MAKER — the controller's new name (owner:
  // "label change only; menu key `launch` and routes unchanged"). It also
  // claims `/story`, whose own row left the tree (its door is the bar's Post
  // Event); the Logo Maker is absorbed below (`STUDIO_ABSORBED.palogo`).
  if (ctx.websiteEnabled) {
    put({
      key: 'launch',
      label: 'Event Hub Maker',
      href: `${base}/launch`,
      icon: 'hub',
      matchPrefix: `${base}/website`,
      alsoMatch: [`${base}/story`],
    });
  }
  put({ key: 'schedule', label: 'Schedule', href: `${base}/schedule`, icon: 'schedule' });
  // Check-in appears in The day WHEN the day comes — on the laptop too now.
  if (phase === 'dayof') {
    put({ key: 'checkin', label: 'Check-in', href: `${base}/guests/checkin`, icon: 'checkin' });
  }
  // 🪑 Gated on the seating surface on the rail too (it used to gate only the
  // phone's day-of tab), so a kind whose /seating redirects gets no dead row.
  if (ctx.seatingEnabled !== false) {
    put({ key: 'seat', label: 'Seat plan', href: `${base}/seating`, icon: 'seat' });
  }
  put({ key: 'studio', label: SUITE_NAV_ON ? 'Suite' : 'Studio', href: studioHubHref(eventId), icon: 'suite' });
  put({ key: 'refer', label: 'Refer a couple', href: `${base}/refer`, icon: 'refer' });

  const unknown: EventMenuRow[] = [];
  for (const t of ctx.studioRows ?? []) {
    const icon = STUDIO_PLACEMENT[t.key];
    if (icon === 'drop') continue;
    const absorbed = STUDIO_ABSORBED[t.key];
    const host = absorbed ? rows.get(absorbed.into) : undefined;
    if (absorbed && host) {
      const claims = [t.href.split('?')[0]!, ...absorbed.routes(base)];
      host.alsoMatch = [...new Set([...(host.alsoMatch ?? []), ...claims])];
      continue;
    }
    const placed = Object.values(SECTION_ORDER).some((keys) => keys.includes(t.key));
    const row: EventMenuRow = {
      key: t.key,
      label: t.name,
      href: t.href,
      icon: icon ?? 'product',
      studio: true,
    };
    if (placed) put(row);
    else unknown.push(row);
  }

  const pick = (keys: string[]): EventMenuRow[] =>
    keys.flatMap((k) => {
      if (k === '__unknown__') return unknown.filter((r) => !hide.has(r.key));
      const r = rows.get(k);
      return r && !hide.has(k) ? [r] : [];
    });

  const sections: EventMenuSection[] = [
    { key: 'event', label: SECTION_LABEL.event, rows: pick(['personalization']) },
    ...(Object.keys(SECTION_ORDER) as Array<keyof typeof SECTION_ORDER>).map((key) => ({
      key,
      label: SECTION_LABEL[key],
      rows: pick(SECTION_ORDER[key]),
    })),
  ];
  // An empty moment hides its heading — dropped here so no surface can draw
  // a heading over nothing.
  return sections.filter((s) => s.rows.length > 0);
}

/** Every row of the tree, in reading order. */
export function eventMenuRows(sections: EventMenuSection[]): EventMenuRow[] {
  return sections.flatMap((s) => s.rows);
}

/**
 * THE MOMENT STRIP (phone only) — the section the current page belongs to.
 *
 * Longest-prefix over every row's claims (`eventMenuRowClaims`: its href,
 * `matchPrefix` and `alsoMatch`), so `/plan3d` — a page of the 3D Plan product
 * absorbed into Seat plan — finds The day. Overview is excluded (it is the event's front page, not a moment), as
 * is the event's Details row. A moment with a single row is not a strip.
 */
export function eventMomentForPath(
  pathname: string,
  sections: EventMenuSection[],
): EventMenuSection | null {
  let best: { section: EventMenuSection; len: number } | null = null;
  for (const section of sections) {
    if (section.key === 'event') continue;
    for (const r of section.rows) {
      if (r.key === 'home') continue;
      for (const m of eventMenuRowClaims(r)) {
        if (pathname === m || pathname.startsWith(`${m}/`)) {
          if (!best || m.length > best.len) best = { section, len: m.length };
        }
      }
    }
  }
  if (!best || best.section.rows.length < 2) return null;
  return best.section;
}

/**
 * THE MOMENT STRIP'S CHIPS — one route child per row of the moment, each
 * matching by the claim that covers THIS page (longest wins: its
 * `matchPrefix`, or a page of a product absorbed into it — `/plan3d` → Seat
 * plan), else its own path. The same claims `eventMomentForPath` used to pick
 * the moment, so the strip that docks and the chip that lights can never
 * disagree. Pure, so the lighting is tested rather than read off the JSX.
 */
export function eventMomentChildren(
  pathname: string,
  moment: EventMenuSection | null,
): CustomerMenuChild[] {
  return (moment?.rows ?? []).map((r) => {
    const claim = eventMenuRowClaims(r)
      .filter((m) => pathname === m || pathname.startsWith(`${m}/`))
      .sort((a, b) => b.length - a.length)[0];
    return {
      key: r.key,
      label: r.label,
      icon: EVENT_MENU_ICONS[r.icon],
      kind: 'route' as const,
      href: r.href,
      match: claim ?? r.href.split('?')[0],
    };
  });
}

/**
 * The phone's bottom bar — FIVE TABS PICKED OUT OF THE ONE TREE, per phase:
 *
 *   plan  → Overview · Papic · Your Team · Guests · Event Hub Controller
 *   dayof → Overview · Papic · Check-in · Event Hub Controller · Schedule
 *   after → Overview · Papic · Galleries · Your Team · Event Hub Controller
 *
 * Every label and href comes from `buildEventMenuSections`, so a tab and its ☰
 * row can never say two words for one page. Only the phone-only extras live
 * here: the broad `activeMatch` that lights a tab, and the Explore takeover's
 * docked children while the replan flag is off.
 *
 * 🔑 Papic replaces the Suite tab (planning) and the Seats tab (day-of) — both
 * stay one tap away in ☰, Seat plan also in The day's strip. The Studio
 * anchor dock (Setnayan AI · Website · Capture · Branding) is retired with the
 * Suite tab that carried it: its four anchors are rows at their moments now.
 *
 * 🔒 THE KEYS DID NOT MOVE: the day-of Overview is still `now` and the after
 * Your Team is still `review`, because the registry slots
 * `customer.bottom-nav.now` / `.review` key off them. Their WORDS moved.
 */
export function buildCustomerMenuTree(
  eventId: string,
  ctx: CustomerMenuCtx = {},
): CustomerMenu[] {
  const base = `/dashboard/${eventId}`;
  const phase = ctx.phase ?? 'plan';
  const sections = buildEventMenuSections(eventId, ctx);
  const byKey = new Map(eventMenuRows(sections).map((r) => [r.key, r]));

  const tab = (
    rowKey: string,
    extra: Partial<CustomerMenu> & { key?: CustomerMenuKey } = {},
  ): CustomerMenu[] => {
    const r = byKey.get(rowKey);
    if (!r) return [];
    return [
      {
        key: (extra.key ?? rowKey) as CustomerMenuKey,
        label: r.label,
        icon: EVENT_MENU_ICONS[r.icon],
        href: r.href,
        activeMatch: r.matchPrefix && r.matchPrefix !== '__home__' ? [r.href, r.matchPrefix] : r.href,
        ...extra,
      },
    ];
  };

  const overview = (key: 'home' | 'now') =>
    tab('home', {
      key,
      activeMatch: phase === 'plan' ? [base, `${base}/checklist`] : base,
      activeMatchExact: true,
    });
  const papic = tab('papic');
  const launch = tab('launch', { activeMatch: `${base}/launch` });

  if (phase === 'dayof') {
    return [
      ...overview('now'),
      ...papic,
      ...tab('checkin'),
      ...launch,
      ...tab('schedule'),
    ];
  }
  if (phase === 'after') {
    return [
      ...overview('home'),
      ...papic,
      ...tab('galleries'),
      // ?tab=build — the SHIPPED deep link (2026-06-12) onto "Your team", the
      // suppliers who actually worked the day, each with its review chip. The
      // after moment is a count on that page, not a second name for it.
      ...tab('explore', { key: 'review', href: `${base}/vendors?tab=build`, activeMatch: `${base}/vendors` }),
      ...launch,
    ];
  }

  return [
    ...overview('home'),
    ...papic,
    ...tab('explore', {
      activeMatch: `${base}/vendors`,
      // THE MOBILE DOCK IS GONE under the Explore replan
      // (Explore_Integration_BUILD_SPEC_2026-07-29 §5). Emitting children ONLY
      // while the flag is OFF keeps the flag an honest kill-switch. The
      // takeover sub-nav shows on the ROOT only.
      ...(isExploreReplanEnabled()
        ? {}
        : {
            sectionMatch: `${base}/vendors`,
            sectionMatchExact: true,
            subnavLabel: 'Services sections',
            children: BUDGET_BUILD_TABS.map((t) => ({
              key: t,
              label: tabLabel(t),
              icon: TAB_META[t].icon,
              kind: 'tab' as const,
              tab: t,
              slotKey: `customer.budget-subnav.${t}`,
            })),
          }),
    }),
    // Guests lights across the people rooms it has always covered — Seat plan
    // and Hosts have rows of their own in ☰, but the TAB is the people room.
    ...tab('guests', {
      activeMatch: [
        `${base}/guests`,
        `${base}/seating`,
        `${base}/plan3d`,
        `${base}/event-qr`,
        `${base}/hosts`,
        `${base}/people`,
      ],
    }),
    ...launch,
  ];
}

/** True when the pathname sits inside a menu's docked-sub-nav SECTION (narrow
 *  match). Exact-equal when `sectionMatchExact`, else prefix (== or startsWith
 *  `${m}/`). Menus with no `sectionMatch` (no children) never match. */
export function matchesMenuSection(pathname: string, menu: CustomerMenu): boolean {
  if (!menu.sectionMatch) return false;
  const ms = Array.isArray(menu.sectionMatch) ? menu.sectionMatch : [menu.sectionMatch];
  return ms.some((m) =>
    menu.sectionMatchExact ? pathname === m : pathname === m || pathname.startsWith(`${m}/`),
  );
}

/** The route-child whose `match` prefix best (longest) covers the pathname, or
 *  null. Mirrors `activeJourneyKey` but generalized over any route children. */
export function activeRouteChildKey(
  pathname: string,
  children: CustomerMenuChild[],
): string | null {
  let best: CustomerMenuChild | null = null;
  for (const c of children) {
    if (c.kind !== 'route' || !c.match) continue;
    if (pathname === c.match || pathname.startsWith(`${c.match}/`)) {
      if (!best || (c.match.length > (best.match?.length ?? 0))) best = c;
    }
  }
  return best?.key ?? null;
}
