/**
 * Customer menu — the SINGLE canonical tree for an event's menu.
 *
 * ─── STAGE D: THE EVENT MENU IS FIVE ROWS (owner 2026-09-29) ─────────────
 * Owner, verbatim: *"so basically. this is what an event needs. Guestlist ·
 * Your Team · Event Hub Maker · Our Services (Papic, Live Studio, Gallery,
 * Patiktok, Music Maker)"* → *"include Setnayan AI (SAI) to our services"*;
 * and, for the phone: *"on mobile mode. we do not want that sub bottom nav
 * anymore. we want it to be simple and easy to manage"*. DECISION_LOG rows
 * "WHAT AN EVENT NEEDS — THE EVENT MENU BECOMES FOUR PILLARS (+ HOME)" and
 * "ON PHONES, NO SUB BOTTOM NAV — ONE SIMPLE BOTTOM BAR"; plan
 * `EVENT_HUB_BUILD_PLAN_2026-09-28.md` § "Stage D".
 *
 *     Home · Guest list · Your Team · Event Hub Maker · More Services
 *
 * The SAME five rows on the desktop rail, in the ☰ drawer and on the phone's
 * one bottom bar, in every phase (plan · day-of · after) and for every event
 * type. Every other screen is reached from INSIDE one of the five — each
 * pillar owns its parts in its own page (a PickMenu, never a second bar):
 *
 *   Guest list      → Guests · Hosts · Check-in   (`lib/pillar-parts.ts`)
 *   Your Team       → Your team · Budget           (`lib/pillar-parts.ts`)
 *   Event Hub Maker → Details (Schedule · Mood Board · Logo · …) + the stages
 *   More Services   → Setnayan AI · Papic · Live Studio · Music Maker ·
 *                     Patiktok — the ONE row that opens (2026-09-30)
 *                     (`lib/our-services.ts`)
 *
 * 🔑 A ROW THAT LEFT THE MENU STILL LIGHTS ITS HOME. Each pillar CLAIMS the
 * pages it now holds (`alsoMatch`), so `/budget` lights Your Team, `/hosts`
 * lights Guest list, `/studio/papic` lights Our Services and `/schedule` the
 * Event Hub Maker — the rail and the bar never show "you are nowhere".
 *
 * ✅ NO INTERIM ROW (train n, 2026-09-29). The Seat plan row waited here for
 * its Details home (Details › Your event › Seat plan, #6138); that home is on
 * main, and `/seating` lands the couple of an Event Hub event there
 * (`detailsIsTheDoor`). So the row is gone and its pages — `/seating` and the
 * 3D view (`STUDIO_ABSORBED.pa3d`) — are claimed by the Event Hub Maker, or by
 * Our Services where there is no Maker (the Schedule's rule, `toolHasGoneHome`).
 *
 * ⚠ THE OLD PHASE-SWAPPING BAR IS RETIRED (plan 5 · day-of 5 · after 5, each a
 * different five — 2026-09-24). The owner's "simple and easy to manage" is one
 * bar that never rearranges itself under the thumb.
 *
 * Neutral module (no `'use client'`): the server layout and the client rail /
 * bar both import it. Icons cross the boundary as NAMES only — see
 * `EventMenuIconName`.
 */

import {
  Home, Users, Compass, Sparkles, Palette, Gem, Globe, Camera, QrCode, Images,
  Newspaper, Wallet, Music, Crown, CalendarDays, Armchair, Box, Radio,
  Clapperboard, Grid2x2, Gift,
  type LucideIcon,
} from 'lucide-react';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { SUITE_NAV_ON, studioHubHref } from './studio-hub';
import { isStoreShellWebOnlyPath } from './store-shell';

/* The Suite doorway flag + href come from `lib/studio-hub.ts` — one branch,
   read by every surface (it used to be re-typed here). */

/**
 * The phone bar's tab keys. 🔒 EVERY KEY IS THE KEY IT WAS: `home` · `guests`
 * · `explore` · `launch` · `studio` drive the registry slots
 * (`customer.bottom-nav.<key>`), badges and hideKeys, and each of those fails
 * SILENTLY on a rename. Only the WORDS moved (Overview → Home, Guests → Guest
 * list, Suite → Our Services).
 */
export type CustomerMenuKey = 'home' | 'guests' | 'explore' | 'launch' | 'studio';

export type CustomerMenu = {
  key: CustomerMenuKey;
  /** Fallback label/icon for surfaces that don't overlay the nav registry.
   *  The bottom nav resolves label/icon from the registry (navSlots) first. */
  label: string;
  icon: LucideIcon;
  href: string;
  /** BROAD active match — lights the bottom-nav TAB: the row's own claims,
   *  plus the claims of any rail row that has no tab of its own. */
  activeMatch: string | string[];
  activeMatchExact?: boolean;
};

export type CustomerMenuCtx = EventMenuCtx & {
  /** Retained for callers; nothing on the one bar is time-gated any more. */
  dayOfOpen?: boolean;
  /** Retained for callers/other consumers; no row routes on it. */
  slug?: string | null;
};

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
  /**
   * Further route families this row claims — the pages it now HOLDS (a part
   * of a pillar, a service of Our Services, a product absorbed into it). Each
   * lights THIS row on the rail and its tab on the bar, exactly as its `href`
   * does. Plain strings: this crosses no boundary as anything else.
   */
  alsoMatch?: string[];
  /**
   * 📂 THE ONE ROW THAT OPENS (owner 2026-09-30, DECISION_LOG "THE SIDEBAR ROW
   * 'MORE SERVICES' EXPANDS TO THE FIVE"): only `studio` ever carries these —
   * the five `buildOurServices` cards, computed server-side and handed in as
   * `ctx.services`. Every other row stays a plain leaf (the 2026-07-15 lock).
   * `the-event-menu-is-one-tree.test.ts` holds "exactly one row has children".
   */
  children?: readonly EventMenuChild[];
};

/** One of the five services under More Services — PLAIN DATA (an icon NAME,
 *  never a component: this crosses the server→client boundary). */
export type EventMenuChild = { key: string; label: string; href: string; icon: EventMenuIconName };

/** `event` = the event's name row (Event settings) · `pillars` = the five. */
export type EventMenuSectionKey = 'event' | 'pillars';

export type EventMenuSection = {
  key: EventMenuSectionKey;
  /** Always '' now — five plain rows need no headings. Kept on the type so a
   *  surface that draws a heading has one place to read it from. */
  label: string;
  rows: EventMenuRow[];
};

/** One Studio product row, as PLAIN DATA — exactly what `railToolsSignedIn`
 *  already returns (key · href · name), already gated for the event type. */
export type EventStudioRow = { key: string; href: string; name: string };

export type EventMenuCtx = {
  phase?: MenuLifecyclePhase;
  hideKeys?: string[];
  /** The event type has an Event Hub (`surfaceEnabled(profile, 'website')`).
   *  Off → no Event Hub Maker row, and the pages the Maker holds (Schedule,
   *  Mood Board, Logo, Editorial) are reached from Our Services instead — the
   *  page that keeps a tool "where there is no Maker" (`toolHasGoneHome`). */
  websiteEnabled?: boolean;
  /** ⚠ UNDEFINED MEANS SEATING — only an explicit `false` stops a row claiming
   *  `/seating` (a kind with no seating, whose /seating redirects home). */
  seatingEnabled?: boolean;
  /**
   * The event's Studio products, from `railToolsSignedIn({eventId, count: 1,
   * profile})` in `layout.tsx`. No product is a ROW any more — each is a card
   * on Our Services — but their pages are CLAIMED here so a product page
   * lights the pillar that holds it. Undefined → only the fixed routes are
   * claimed (this module must not pull the whole add-on catalogue into a
   * client bundle to guess). `the-event-menu-is-one-tree.test.ts` fails if the
   * layout stops passing it.
   */
  studioRows?: ReadonlyArray<EventStudioRow>;
  /**
   * Is this the App Store / Play Store shell? Resolved ONCE, server-side, by
   * `isStoreShellRequest()` in `layout.tsx`. When true, every row whose door
   * `lib/store-shell.ts` refuses is DROPPED from the tree — see
   * `storeShellRefusesMenuRow` below. Undefined → the web: nothing is dropped.
   */
  storeShell?: boolean;
  /**
   * The five services under the More Services row (Setnayan AI · Papic · Live
   * Studio · Music Maker · Patiktok), built in `layout.tsx` by
   * `buildOurServices` → `ourServicesMenuChildren` — the SAME cards the More
   * Services page draws. Computed there so this module never pulls the add-on
   * catalogue into a client bundle. Undefined → the row has no children.
   */
  services?: ReadonlyArray<EventMenuChild>;
};

/**
 * ─── THE STORE SHELL'S ONE ROSTER FILTER (2026-09-25) ─────────────────────
 * A refused row is never BUILT — a row hidden after paint left a blank slot in
 * the phone's grid (the Papic tab the owner saw on 2026-09-25). None of the
 * five pillars is refused today (Our Services filters its own cards), but the
 * filter stays at the one place every surface reads, so a future refusal
 * cannot reintroduce the blank slot.
 *
 * ⚠ THE REFUSED LIST IS NOT RESTATED. It is `isStoreShellWebOnlyPath` — the
 * same function middleware uses.
 */
export function storeShellRefusesMenuRow(href: string, storeShell: boolean | undefined): boolean {
  if (!storeShell) return false;
  return isStoreShellWebOnlyPath(href.split('#')[0]!.split('?')[0]!);
}

/**
 * ─── A PRODUCT WHOSE PAGES ANOTHER ROW HOLDS ──────────────────────────────
 * Every other product's pages are claimed by Our Services (its card is
 * there). These three live somewhere else, so they are claimed there:
 *
 *   pa3d        → the Event Hub Maker — the 3D view is the seat plan's own
 *                 `List | 2D | 3D` segment (owner 2026-09-24, "the 3D version
 *                 is on the seatplan already"), and the Seat plan is Details ›
 *                 Your event › Seat plan.
 *   palogo      → the Event Hub Maker — Details › Logo (owner 2026-09-24/25:
 *                 "the logo maker lives in the editor").
 *   mood-board  → the Event Hub Maker — Details › Mood Board (owner
 *                 2026-09-29: "schedule, mood board and seat plan will be
 *                 inside").
 *
 * With no host row (no Maker for this kind, or no seating) the product falls
 * back to Our Services, whose page keeps the tool where there is no Maker.
 * 🔒 THE KEYS STAY (`pa3d`, `palogo`, `mood-board`) — they are the catalogue's.
 */
export const STUDIO_ABSORBED: Readonly<
  Record<string, { into: string; routes: (base: string) => string[] }>
> = {
  pa3d: { into: 'launch', routes: (base) => [`${base}/seating/lab`, `${base}/plan3d`] },
  palogo: { into: 'launch', routes: (base) => [`${base}/monogram`] },
  'mood-board': { into: 'launch', routes: (base) => [`${base}/studio/mood-board`] },
};

/** Products no row claims: the Event Hub product IS the Maker row's page
 *  (one door, 2026-09-02), and `__all__` IS the Our Services row. */
const UNCLAIMED_PRODUCTS = new Set(['pawebsite', '__all__']);

/** Every path a row claims: its href, its `matchPrefix`, its `alsoMatch`. */
export function eventMenuRowClaims(r: EventMenuRow): string[] {
  return [r.href.split('?')[0]!, r.matchPrefix, ...(r.alsoMatch ?? [])].filter(
    (m): m is string => !!m && m !== '__home__',
  );
}

/** THE FIVE, in the owner's order. */
const PILLAR_ROWS = ['home', 'guests', 'explore', 'launch', 'studio'] as const;

/**
 * THE tree. Every event-menu surface reads this — the rail, the ☰ drawer and
 * the phone's bottom bar.
 */
export function buildEventMenuSections(
  eventId: string,
  ctx: EventMenuCtx = {},
): EventMenuSection[] {
  const base = `/dashboard/${eventId}`;
  const hide = new Set(ctx.hideKeys ?? []);
  const maker = !!ctx.websiteEnabled;
  // The Seat plan's page — held by the Maker (Details › Your event › Seat plan)
  // or, with no Maker, by Our Services. None where the kind seats nobody (its
  // /seating redirects home), so no row claims a door that is not there.
  const seatPages = ctx.seatingEnabled !== false ? [`${base}/seating`] : [];

  const rows = new Map<string, EventMenuRow>();
  const put = (r: EventMenuRow) => rows.set(r.key, r);

  // The event's name row (Event settings) — drawn AS the name, not as a row.
  put({ key: 'personalization', label: 'Details', href: `${base}/details`, icon: 'details' });

  // HOME — the event's front page. Sentinel matchPrefix: every other event
  // route shares `${base}/`, so only the exact pathname may light it.
  put({ key: 'home', label: 'Home', href: base, icon: 'overview', matchPrefix: '__home__' });

  // GUEST LIST — the people room: Guests · Hosts · Check-in are its parts
  // (`guestListParts`), and the pages about the same people light it.
  put({
    key: 'guests',
    label: 'Guest list',
    href: `${base}/guests`,
    icon: 'guests',
    alsoMatch: [`${base}/hosts`, `${base}/event-qr`, `${base}/people`],
  });

  // YOUR TEAM — suppliers + Budget (`yourTeamParts`). The old /budget page
  // lands on the part; its standalone address still lights this row.
  put({
    key: 'explore',
    label: 'Your Team',
    href: `${base}/vendors`,
    icon: 'team',
    alsoMatch: [`${base}/budget`],
  });

  // EVENT HUB MAKER — one row, one word, every phase (key `launch`, 2026-09-02).
  // `matchPrefix` claims the /website family; `/story` is its Post Event;
  // `/schedule` is Details › Schedule (the page lands there for the couple).
  if (maker) {
    put({
      key: 'launch',
      label: 'Event Hub Maker',
      href: `${base}/launch`,
      icon: 'hub',
      matchPrefix: `${base}/website`,
      alsoMatch: [
        `${base}/story`,
        `${base}/schedule`,
        // `/seating` is Details › Your event › Seat plan (the page lands there).
        ...seatPages,
      ],
    });
  }

  // MORE SERVICES — the Suite page is this pillar ("Suite becomes this page").
  // It holds Galleries (its Gallery card) and, below, every product page no
  // other row holds. Where there is no Maker, it also holds the pages the
  // Maker would have (its page keeps those tools — `toolHasGoneHome`).
  // "Our Services" → "More Services" (owner 2026-09-30: *"it cannot be our
  // services since we have the guestlist, your team and event hub maker on the
  // sidebar which is also our services"*). 🔒 The KEY stays `studio`.
  const hub = studioHubHref(eventId);
  const services = ctx.services ?? [];
  put({
    key: 'studio',
    label: SUITE_NAV_ON ? 'More Services' : 'Studio',
    href: hub,
    icon: 'suite',
    ...(services.length ? { children: services.map((c) => ({ ...c })) } : {}),
    alsoMatch: [
      `${base}/suite`,
      `${base}/studio`,
      `${base}/galleries`,
      ...(maker ? [] : [`${base}/story`, `${base}/schedule`]),
      ...(maker ? [] : seatPages),
    ].filter((m) => m !== hub.split('?')[0]),
  });

  // THE PRODUCTS' PAGES — claimed by whichever row holds them.
  const claim = (key: string, paths: string[]) => {
    const host = rows.get(key);
    if (!host) return false;
    host.alsoMatch = [...new Set([...(host.alsoMatch ?? []), ...paths])];
    return true;
  };
  for (const t of ctx.studioRows ?? []) {
    if (UNCLAIMED_PRODUCTS.has(t.key)) continue;
    const own = t.href.split('?')[0]!;
    const absorbed = STUDIO_ABSORBED[t.key];
    if (absorbed && claim(absorbed.into, [own, ...absorbed.routes(base)])) continue;
    claim('studio', absorbed ? [own, ...absorbed.routes(base)] : [own]);
  }

  // 🍎 A row the store shell refuses is never built — `storeShellRefusesMenuRow`.
  const refused = (r: EventMenuRow) => storeShellRefusesMenuRow(r.href, ctx.storeShell);
  const pick = (keys: readonly string[]): EventMenuRow[] =>
    keys.flatMap((k) => {
      const r = rows.get(k);
      return r && !hide.has(k) && !refused(r) ? [r] : [];
    });

  const sections: EventMenuSection[] = [
    { key: 'event', label: '', rows: pick(['personalization']) },
    { key: 'pillars', label: '', rows: pick(PILLAR_ROWS) },
  ];
  // An empty section is dropped here, so no surface can draw over nothing.
  return sections.filter((s) => s.rows.length > 0);
}

/** Every row of the tree, in reading order. */
export function eventMenuRows(sections: EventMenuSection[]): EventMenuRow[] {
  return sections.flatMap((s) => s.rows);
}

/**
 * ─── THE PHONE BAR'S SHORT WORDS (owner 2026-09-29) ─────────────────────
 * Owner, on the one bar: *"accept it. Maker and Services"*. On the PHONE
 * bottom bar only, two tabs wear a short form of their row's name — five
 * full names do not fit a 375px bar on one line. The desktop rail and the ☰
 * drawer keep the full names ("Event Hub Maker", "More Services"), and so does
 * the tour. This map is the ONE place a phone word may differ from its row;
 * `the-phone-has-one-bottom-bar.test.ts` fails on any other difference.
 * (Where the Suite flag is off the row says "Studio", and so does the tab.)
 */
export const PHONE_BAR_SHORT: Readonly<Partial<Record<CustomerMenuKey, string>>> = {
  launch: 'Maker',
  // "More" (owner 2026-09-30) — the rail and ☰ say "More Services".
  ...(SUITE_NAV_ON ? { studio: 'More' } : {}),
};

/**
 * THE PHONE'S ONE BOTTOM BAR — the five pillars, picked out of the one tree,
 * the same in every phase:
 *
 *     Home · Guest list · Your Team · Event Hub Maker · More Services
 *
 * Every label and href comes from `buildEventMenuSections`, so a tab and its ☰
 * row can never say two words for one page — except the two short words in
 * `PHONE_BAR_SHORT` (Maker · More), which the owner chose for the bar. A
 * tab lights across every page its row claims — every rail row IS a tab now.
 *
 * 📂 THE BAR HAS NO SUB-ROWS. More Services' five children are the rail's;
 * on the phone the "More" tab opens a chooser sheet with the same five
 * (`CustomerBottomNav` → `more-services-sheet.tsx`, owner 2026-09-30).
 *
 * 🔑 NOTHING DOCKS ABOVE IT. There is no section sub-nav and no moment strip
 * any more (owner 2026-09-29, "we do not want that sub bottom nav anymore");
 * a pillar's parts are picked INSIDE its page. `the-phone-has-one-bottom-bar
 * .test.ts` holds that.
 */
export function buildCustomerMenuTree(
  eventId: string,
  ctx: CustomerMenuCtx = {},
): CustomerMenu[] {
  const base = `/dashboard/${eventId}`;
  const phase = ctx.phase ?? 'plan';
  const all = eventMenuRows(buildEventMenuSections(eventId, ctx));
  const byKey = new Map(all.map((r) => [r.key, r]));

  return PILLAR_ROWS.flatMap((key): CustomerMenu[] => {
    const r = byKey.get(key);
    if (!r) return [];
    const label = PHONE_BAR_SHORT[key] ?? r.label;
    if (key === 'home') {
      return [
        {
          key,
          label,
          icon: EVENT_MENU_ICONS[r.icon],
          href: r.href,
          // The checklist is the Home page's own "View your full checklist".
          activeMatch: [base, `${base}/checklist`],
          activeMatchExact: true,
        },
      ];
    }
    return [
      {
        key,
        label,
        icon: EVENT_MENU_ICONS[r.icon],
        // After the day, Your Team opens on the suppliers who worked it, each
        // with its review chip — the SHIPPED deep link (2026-06-12).
        href: key === 'explore' && phase === 'after' ? `${r.href}?tab=build` : r.href,
        activeMatch: [...new Set(eventMenuRowClaims(r))],
      },
    ];
  });
}
