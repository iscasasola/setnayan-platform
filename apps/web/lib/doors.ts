/**
 * doors.ts — the business doors: supplier.setnayan.com and coordinator.setnayan.com (business.setnayan.com is an
 * alias of the supplier door). Owner, 24 Nov 2026; drawing "Business door drawing" v7, approved.
 *
 * ─── ONE MAP ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * `DOOR_HOSTS` is the only place a door's host label is written. Everything else asks this file:
 *   · middleware routes a door host by it (`doorRoute`): `/` is an internal rewrite to the door's front page (the
 *     address bar keeps the door's name), the five legal pages open inside the door, and any other page is a 308 to
 *     the same path on the site (setnayan.com) — sign-in never runs on a door host, so there is ONE auth origin;
 *   · the shared shell reads the door (`DOOR_HEADER`, set by middleware) and draws the door's chrome: no rail, no
 *     menu button, no search, no couple links, a wordmark that is not a way out, and one legal line;
 *   · the sign-in card reads `?door=` (`/login?door=X`): its words, its ✕ (back to the door), its "Create one, free"
 *     (the shop set-up, Coordination already picked on the coordinator door) and where a sign-in lands;
 *   · the landing rule is `landingForAccount` (lib/auth-confirm-link.ts) with the door — never a second copy.
 *
 * 🔒 Every label in the map is reserved: middleware answers it before the paid event-subdomain rewrite, and
 * `RESERVED_SLUGS` (lib/reserved-slugs.ts) refuses it as an event or shop address. Held by lib/doors.test.ts.
 *
 * Pure on purpose (no `server-only`, no request): middleware, the client shell and node:test all import it.
 */
import { POLICY_LINKS } from './policy-links';

/** The two doors. A door is who the page speaks to; a host label is how a person typed it. */
export const DOORS = ['supplier', 'coordinator'] as const;
export type Door = (typeof DOORS)[number];

type DoorHost = { door: Door; front: string } | { aliasOf: string };

/**
 * THE ONE MAP — a door host's label → its front page and its door, or the label it is an alias of.
 * `business` forwards to `supplier` (owner 24 Nov: "business.setnayan.com forwards here").
 */
export const DOOR_HOSTS = {
  supplier: { door: 'supplier', front: '/for-suppliers' },
  coordinator: { door: 'coordinator', front: '/for-coordinators' },
  business: { aliasOf: 'supplier' },
} as const satisfies Record<string, DoorHost>;

export type DoorLabel = keyof typeof DOOR_HOSTS;

/** Every label in the map — each one is reserved (middleware, `RESERVED_SLUGS`). */
export const DOOR_LABELS: readonly DoorLabel[] = Object.keys(DOOR_HOSTS) as DoorLabel[];

/** The request header middleware sets on a door host (and on `/login?door=X`); the shared shell reads it. */
export const DOOR_HEADER = 'x-sn-door';
/** The query parameter that carries a door to the one sign-in card: `/login?door=supplier`. */
export const DOOR_PARAM = 'door';

/** The door's label, the way the map writes it (`supplier` → `supplier`). */
function labelOfDoor(door: Door): DoorLabel {
  return (Object.keys(DOOR_HOSTS) as DoorLabel[]).find((l) => {
    const h: DoorHost = DOOR_HOSTS[l];
    return 'door' in h && h.door === door;
  })!;
}

/** A door named on a query string or a header, or `null`. Only the doors in `DOORS` — never a guess. */
export function parseDoor(raw: unknown): Door | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return (DOORS as readonly string[]).includes(s) ? (s as Door) : null;
}

/** `host[:port]` → the label of a door host (`supplier.setnayan.com`, and `supplier.localhost` in dev), or `null`. */
export function doorLabelOfHost(host: string): DoorLabel | null {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  const m = h.match(/^([a-z0-9-]+)\.(?:setnayan\.com|localhost)$/);
  if (!m) return null;
  return Object.prototype.hasOwnProperty.call(DOOR_HOSTS, m[1]!) ? (m[1] as DoorLabel) : null;
}

/** The site's apex (`www.setnayan.com` → `setnayan.com`, `localhost:3000` stays) and its scheme. */
function apexOf(origin: string): { protocol: string; host: string } {
  const u = new URL(origin);
  return { protocol: u.protocol, host: u.host.replace(/^www\./, '') };
}

/** A door's own front page, absolute: `https://supplier.setnayan.com/`. `origin` is `siteOrigin()`. */
export function doorFrontHref(door: Door, origin: string): string {
  const { protocol, host } = apexOf(origin);
  return `${protocol}//${labelOfDoor(door)}.${host}/`;
}

/** Every sign-in or sign-up control on a door goes to the ONE auth origin: `https://<site>/login?door=X`. */
export function doorSignInHref(door: Door, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/login?${DOOR_PARAM}=${door}`;
}

/** Where a door's sign-in hands off: the one landing route, which asks `landingForAccount` with the door. */
export function doorLandingHref(door: Door): string {
  return `/auth/door?${DOOR_PARAM}=${door}`;
}

/**
 * The shop set-up a door's person starts at — the same account gains a shop, never a second account.
 * On the coordinator door, Coordination is already picked (`/open-shop?as=coordinator`, the shipped wizard's own).
 */
export function doorOpenShopHref(door: Door): string {
  return door === 'coordinator' ? '/open-shop?as=coordinator' : '/open-shop';
}

/** The pages that open INSIDE a door (drawing: "one legal line … that opens inside this same door"). */
const PAGES_INSIDE_A_DOOR: ReadonlySet<string> = new Set(POLICY_LINKS.map((p) => p.href));

/** What middleware does with a request on a door host. */
export type DoorRoute =
  /** `/` → an internal rewrite to the door's front page; the address bar keeps the door's name. */
  | { kind: 'front'; door: Door; rewrite: string }
  /** A legal page, or the framework's own files: served here, wearing the door. */
  | { kind: 'inside'; door: Door }
  /** Anything else (and every request to an alias host): a 308 to this address. */
  | { kind: 'away'; to: string };

/**
 * Route one request on a door host, or `null` when the host is not a door. `origin` is `siteOrigin()` — where every
 * page that is not the door's own goes, with its path and query kept.
 */
export function doorRoute(host: string, pathname: string, search: string, origin: string): DoorRoute | null {
  const label = doorLabelOfHost(host);
  if (!label) return null;
  const entry: DoorHost = DOOR_HOSTS[label];
  if ('aliasOf' in entry) {
    const port = host.match(/:\d+$/)?.[0] ?? '';
    const apex = host.toLowerCase().replace(/:\d+$/, '').slice(label.length + 1);
    const { protocol } = new URL(origin);
    return { kind: 'away', to: `${protocol}//${entry.aliasOf}.${apex}${port}${pathname}${search}` };
  }
  if (pathname === '/') return { kind: 'front', door: entry.door, rewrite: entry.front };
  // The framework's own requests (`/_next/…`, `/api/…`) and files are served where they were asked for.
  if (pathname.startsWith('/_') || pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname)) {
    return { kind: 'inside', door: entry.door };
  }
  if (PAGES_INSIDE_A_DOOR.has(pathname)) return { kind: 'inside', door: entry.door };
  return { kind: 'away', to: `${origin.replace(/\/+$/, '')}${pathname}${search}` };
}

/**
 * 📱 THE SAME FLAG FROM AN APP SHELL (owner, DECISION_LOG 866cebc5: a "Setnayan Business" phone app, a second
 * Capacitor shell that opens supplier.setnayan.com, whose suppliers "never jump out of their dashboard"). The app is
 * not built here; this is only how it will turn the ONE door flag on, on any host — the same two signals the
 * existing shell uses (`SetnayanApp` in the user agent, the `setnayan-client-type` cookie; lib/request-platform.ts):
 *   · a `SetnayanBusiness` user-agent marker (`SetnayanBusiness/coordinator` names the coordinator door);
 *   · or a `setnayan-door` cookie holding a door.
 * Middleware sets `DOOR_HEADER` from it on every page, so the signed-in dashboard wears the door too (no Home, no
 * switch to the personal side, no Discover) — one flag, never a second switch.
 */
export const DOOR_APP_UA = /\bSetnayanBusiness(?:\/([a-z]+))?/i;
export const DOOR_COOKIE = 'setnayan-door';

/** The door an app shell asks for, or `null` (a browser). The user agent wins over the cookie. */
export function appShellDoor(userAgent: string | null | undefined, cookie: string | null | undefined): Door | null {
  const m = (userAgent ?? '').match(DOOR_APP_UA);
  if (m) return parseDoor(m[1] ?? 'supplier') ?? 'supplier';
  return parseDoor(cookie);
}

/** The sign-in card's words on a door: kept in a leaf module so the client card never pulls this file. */
export { DOOR_SIGN_IN_WORDS } from './door-words';
