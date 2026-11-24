/**
 * door-map.ts — THE ONE DOOR MAP and the few door links the client needs. A LEAF on purpose: no imports.
 *
 * `lib/doors.ts` is the doors' home (host routing, the app-shell flag, the front and sign-in links) and re-exports
 * everything here, so callers keep importing `@/lib/doors`. Only modules that reach the browser on every page import
 * this file directly — `lib/reserved-slugs.ts` (the root layout's theme script reads it) and `lib/auth-confirm-link.ts`
 * (the shell's sign-in landing) — so a couple's first load carries the map and three links, never the door routing.
 * The Event Hub Maker's first-load budget is held by CI (bundle size check, #8263); lib/doors.test.ts holds the leaf.
 */
/** The two doors. A door is who the page speaks to; a host label is how a person typed it. */
export const DOORS = ['supplier', 'coordinator'] as const;
export type Door = (typeof DOORS)[number];

export type DoorHost = { door: Door; front: string } | { aliasOf: string };

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

/** Where a door's sign-in hands off: the one landing route, which asks `landingForAccount` with the door. */
export function doorLandingHref(door: Door): string {
  return `/auth/door?${DOOR_PARAM}=${door}`;
}

/**
 * Where a door's person with a shop lands: the supplier dashboard. Written here, not read from `lib/routes`, on
 * purpose: this leaf reaches the client shell (`front-door-shell` → `sign-in-landing` → `auth-confirm-link`), and the
 * route table is 25 KB the Event Hub Maker's first load cannot afford (bundle budget, #8263). Held by lib/doors.test.ts,
 * which checks it against `routes.vendorDashboard.index()`.
 */
export function doorShopHomeHref(): string {
  return '/vendor-dashboard';
}

/**
 * The shop set-up a door's person starts at — the same account gains a shop, never a second account.
 * On the coordinator door, Coordination is already picked (`/open-shop?as=coordinator`, the shipped wizard's own).
 */
export function doorOpenShopHref(door: Door): string {
  return door === 'coordinator' ? '/open-shop?as=coordinator' : '/open-shop';
}
