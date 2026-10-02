/**
 * lib/ugat/screens.ts — the SCREENS and DOORS layers of the Ugat map (slice 1).
 *
 * Owner, 2026-10-02 (DECISION_LOG "ONE MAP OF THE APP"): extend Setup (Ugat)
 * with every page of the host, guest and supplier apps, the ways in to each
 * one, and — in slice 2 — the fields each one saves. This file is the SHAPE of
 * that layer and the pure helpers that read it; it touches no filesystem, so
 * the admin surface can import it. The scanner that FILLS it lives in
 * `scan-screens.ts` (generator + guard only), and the committed result is
 * `screens.generated.json`.
 *
 * 🔑 EXTEND, NEVER A FOURTH MAP. A screen's Ugat node(s) are the existing
 * `UGAT_TYPES` ids, inferred from the tables its code reads — the same
 * table → node binding `concept-coverage` already uses. Admin pages are NOT
 * repeated here: `lib/admin-map/admin-routes.generated.ts` owns them, and this
 * layer only uses the admin tree to know that a door into `/admin/…` is real.
 *
 * ── SLICE 2 ATTACHES FIELDS BY `id` ────────────────────────────────────────
 * Every screen carries a stable `id` (its route pattern). The FIELDS layer —
 * every input → the one table.column it saves to — will be generated beside
 * this one and keyed by that id, so adding it changes no existing row here.
 * The optional `fields` property is reserved for it.
 */

/** Who a screen is for. Decided by its URL — see `SCREEN_AREA_RULES`. */
export type ScreenArea = 'host' | 'guest' | 'supplier' | 'onboarding' | 'public' | 'internal';

/**
 * How a door was found.
 *  link            — an href (JSX `href=`, an object `href:`/`…Href:`/`url:`)
 *  navigate        — router.push/replace, location.href/assign, window.open
 *  redirect        — redirect()/permanentRedirect()/NextResponse.redirect()
 *  builder         — a `routes.…()` builder from lib/routes.ts
 *  nav-registry    — a `route:` slot in lib/nav-registry-defaults.ts (the menu registry)
 *  menu            — any door written in a nav/menu/rail/bar file
 *  email           — an email or notification URL builder
 *  legacy-redirect — a next.config.ts redirect (only someone holding the OLD address arrives)
 *  sitemap         — sitemap / robots / llms.txt (search engines, not people in the app)
 *  admin           — written in the admin console (staff, not the person the screen is for)
 *  internal        — written in a dev/prototype/demo-capture page
 */
export type DoorKind =
  | 'link'
  | 'navigate'
  | 'redirect'
  | 'builder'
  | 'nav-registry'
  | 'menu'
  | 'email'
  | 'legacy-redirect'
  | 'sitemap'
  | 'admin'
  | 'internal';

/** Doors that do NOT make a screen reachable for the person it is for. */
export const NON_CONNECTING_DOORS: ReadonlySet<DoorKind> = new Set<DoorKind>([
  'legacy-redirect',
  'sitemap',
  'admin',
  'internal',
]);

/** Phone vs desktop — only where the registry or the file says so. */
export type DoorSurface = 'phone' | 'desktop' | 'both';

export interface ScreenDoor {
  /** Repo-relative-to-apps/web source file the door is written in. */
  from: string;
  kind: DoorKind;
  surface: DoorSurface;
}

export type ScreenStatus = 'connected' | 'no-door' | 'stub';

/** Reserved for slice 2 (FIELDS): one input → the one table.column it saves to. */
export interface ScreenField {
  /** e.g. `guests.rsvp_status` */
  saves: string;
  /** The control's own name, as written. */
  control: string;
}

export interface UgatScreen {
  /** Stable key — the route pattern. Slice 2's FIELDS layer attaches by this id. */
  id: string;
  /** The URL pattern, e.g. `/dashboard/[eventId]/guests`. Route groups dropped. */
  route: string;
  /** The page file, relative to apps/web. */
  file: string;
  area: ScreenArea;
  /**
   * `stub` = a legacy redirect page that draws nothing and forwards on.
   * `connected` = at least one door a person in the app can use.
   * `no-door` = none — reachable only by knowing the URL.
   */
  status: ScreenStatus;
  /** For a stub: where it forwards. */
  redirectsTo: string | null;
  /** UGAT_TYPES ids this screen belongs to. Empty = unmapped. */
  nodes: string[];
  /** The tables that put it on those nodes — the evidence, never a guess. */
  tables: string[];
  /** Every way in found statically, self-links excluded. Sorted, deduped by (from, kind). */
  doors: ScreenDoor[];
  /** Slice 2. */
  fields?: ScreenField[];
}

export interface BrokenDoor {
  /** The file the door is written in. */
  from: string;
  /** The address it points at (placeholders shown as `*`). */
  to: string;
  kind: DoorKind;
}

export interface LegacyRedirect {
  source: string;
  destination: string;
}

export interface UgatScreensMap {
  version: 1;
  screens: UgatScreen[];
  /** Doors that point at an address no page, handler, redirect or file answers. */
  brokenDoors: BrokenDoor[];
  /** next.config.ts redirects — old addresses that forward to a screen. */
  legacyRedirects: LegacyRedirect[];
}

/**
 * URL prefix → area. First match wins; specific before general. The URL is
 * what the person sees, so it decides — not the folder (route groups such as
 * `(shell)` are invisible in the address).
 */
export const SCREEN_AREA_RULES: ReadonlyArray<{ prefix: string; area: ScreenArea }> = [
  { prefix: '/dev', area: 'internal' },
  { prefix: '/prototype', area: 'internal' },
  { prefix: '/demo-capture', area: 'internal' },
  { prefix: '/dashboard', area: 'host' },
  { prefix: '/site-editor', area: 'host' },
  { prefix: '/host', area: 'host' },
  { prefix: '/panood/control', area: 'host' },
  { prefix: '/panood/program', area: 'host' },
  { prefix: '/proposals', area: 'host' },
  { prefix: '/vendor-dashboard', area: 'supplier' },
  { prefix: '/vendor-invite', area: 'supplier' },
  { prefix: '/vendor/', area: 'supplier' },
  { prefix: '/open-shop', area: 'supplier' },
  { prefix: '/onboarding', area: 'onboarding' },
  { prefix: '/signup', area: 'onboarding' },
  { prefix: '/login', area: 'onboarding' },
  { prefix: '/forgot-password', area: 'onboarding' },
  { prefix: '/reset-password', area: 'onboarding' },
  { prefix: '/[slug]', area: 'guest' },
  { prefix: '/join', area: 'guest' },
  { prefix: '/claim', area: 'guest' },
  { prefix: '/wall', area: 'guest' },
  { prefix: '/live', area: 'guest' },
  { prefix: '/panood/cam', area: 'guest' },
  { prefix: '/papic/', area: 'guest' },
  { prefix: '/samahan/join', area: 'guest' },
  { prefix: '/pay/', area: 'guest' },
  { prefix: '/receipts/', area: 'guest' },
];

export function areaForRoute(route: string): ScreenArea {
  for (const r of SCREEN_AREA_RULES) {
    // `/vendor/` covers `/vendor/claim/…` but not `/vendor-dashboard`; a bare
    // `/dashboard` covers itself and everything under it.
    const hit = r.prefix.endsWith('/')
      ? route.startsWith(r.prefix)
      : route === r.prefix || route.startsWith(`${r.prefix}/`);
    if (hit) return r.area;
  }
  return 'public';
}

export const SCREEN_AREA_ORDER: readonly ScreenArea[] = [
  'host',
  'guest',
  'supplier',
  'onboarding',
  'public',
  'internal',
];

export const SCREEN_AREA_LABEL: Record<ScreenArea, string> = {
  host: 'Host app',
  guest: 'Guest app',
  supplier: 'Supplier app',
  onboarding: 'Sign-in & onboarding',
  public: 'Public site',
  internal: 'Internal (dev, prototypes)',
};

export interface ScreensSummary {
  screens: number;
  connected: number;
  noDoor: number;
  stubs: number;
  unmapped: number;
  brokenDoors: number;
}

/** Counts for the badge row, the report and the CI check — one derivation. */
export function summarizeScreens(map: UgatScreensMap): ScreensSummary {
  const s = map.screens;
  return {
    screens: s.length,
    connected: s.filter((x) => x.status === 'connected').length,
    noDoor: s.filter((x) => x.status === 'no-door').length,
    stubs: s.filter((x) => x.status === 'stub').length,
    unmapped: s.filter((x) => x.status !== 'stub' && x.nodes.length === 0).length,
    brokenDoors: map.brokenDoors.length,
  };
}

/** Screens grouped by area in the display order, each group sorted by route. */
export function screensByArea(map: UgatScreensMap): Array<{ area: ScreenArea; screens: UgatScreen[] }> {
  return SCREEN_AREA_ORDER.map((area) => ({
    area,
    screens: map.screens.filter((x) => x.area === area),
  })).filter((g) => g.screens.length > 0);
}

/** Doors that make a screen reachable for the person it is for. */
export function connectingDoors(screen: UgatScreen): ScreenDoor[] {
  return screen.doors.filter((d) => !NON_CONNECTING_DOORS.has(d.kind));
}
