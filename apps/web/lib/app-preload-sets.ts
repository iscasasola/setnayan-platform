/**
 * 📲 WHAT A SIGNED-IN PERSON'S PHONE PRELOADS — BY WHAT THE ACCOUNT HAS.
 *
 * Owner, 2026-10-02 (DECISION_LOG "A HOST'S WHOLE APP LOADS ONCE, IN THE
 * BACKGROUND…" amended by "THE PRELOAD FOLLOWS WHAT THE ACCOUNT HAS: ITS EVENTS
 * AND ITS SHOP"): *"when someone logs in, it has their events, and their
 * shop."* Wherever they land (their account home, an event's Home, their
 * shop's Today), once the page is idle:
 *   · an event they HOST → the HOST SET: every page of that event's menu (the
 *     SAME tree the rail, the ☰ and the phone's bar draw — `lib/customer-menu`)
 *     — Home · Guests · Suppliers · Hub (the Maker) · More's pages. The Maker's
 *     tool panels follow the moment the Maker opens (`maker-tools.tsx`), its
 *     own code already on the phone;
 *   · a SHOP they own or staff → the SUPPLIER SET: Today · Customers · Shop ·
 *     More and More's rows (`lib/vendor-more-rows.ts`);
 *   · both → both; only guest invitations → NOTHING.
 * Never an admin page, never a public page (a guest's invitation, the
 * marketing site). The mechanism is `lib/app-preload.ts`; the trigger
 * `app/_components/app-preload.tsx`. Pure — `app-preload-sets.test.ts`.
 */
import { buildEventMenuSections, eventMenuRows, type EventMenuCtx } from '@/lib/customer-menu';
import { VENDOR_MORE_ROWS } from '@/lib/vendor-more-rows';

/** The supplier bar, in its order (`vendor-nav-destinations.ts` — a client file; the test holds them equal). */
export const SUPPLIER_BAR_ROUTES = ['/vendor-dashboard', '/vendor-dashboard/customers', '/vendor-dashboard/shop', '/vendor-dashboard/more'] as const;

/** Never preloaded, whoever asks: the admin console and anything outside the signed-in app. */
export function isPreloadableAppRoute(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  return href.startsWith('/dashboard/') || href === '/vendor-dashboard' || href.startsWith('/vendor-dashboard/');
}

const pathOf = (href: string) => href.split(/[?#]/)[0]!;

function unique(hrefs: Iterable<string>): string[] {
  return [...new Set([...hrefs].map(pathOf))].filter(isPreloadableAppRoute);
}

/** The host set for one event: every page its menu opens, Home first, then the bar's order. */
export function hostAppRoutes(eventId: string, ctx: EventMenuCtx = {}): string[] {
  const base = `/dashboard/${eventId}`;
  const rows = eventMenuRows(buildEventMenuSections(eventId, ctx));
  const own = rows.map((r) => r.href).filter((h) => h === base || h.startsWith(`${base}/`) || h.startsWith(`${base}?`));
  const bar = ['home', 'guests', 'explore', 'launch'];
  const byKey = new Map(rows.map((r) => [r.key, r.href]));
  const first = bar.map((k) => byKey.get(k)).filter((h): h is string => !!h);
  return unique([base, ...first, ...own]);
}

/** The supplier set: the four places on the bar, then More's rows. */
export function supplierAppRoutes(): string[] {
  return unique([...SUPPLIER_BAR_ROUTES, ...VENDOR_MORE_ROWS.map((r) => r.href)]);
}

/** The Maker's own address for an event. */
export function makerRouteOf(eventId: string): string {
  return `/dashboard/${eventId}/launch`;
}

export type AppPreloadPlan = {
  /** Pages whose code to bring to the phone, the host set first (where they landed), then the shop. */
  routes: string[];
};

/**
 * What to preload for an account. `hostEventId` is the event they host that the
 * host set is built for (the one they are in, or their primary one) — null when
 * they host none. `hostMenu` is that event's menu context when the caller has it.
 */
export function appPreloadPlan(input: {
  hostEventId: string | null;
  hostMenu?: EventMenuCtx;
  hasShop: boolean;
}): AppPreloadPlan {
  const host = input.hostEventId ? hostAppRoutes(input.hostEventId, input.hostMenu ?? { websiteEnabled: true }) : [];
  const shop = input.hasShop ? supplierAppRoutes() : [];
  return { routes: unique([...host, ...shop]) };
}

/** The event a person hosts that their account home preloads: their primary hosted event, else the first. */
export function hostedEventOf(events: ReadonlyArray<{ event_id: string; role: string; is_primary?: boolean }>): string | null {
  const hosted = events.filter((e) => e.role === 'couple');
  return (hosted.find((e) => e.is_primary) ?? hosted[0])?.event_id ?? null;
}
