/**
 * Customers = People · Dates · Money — which one a URL opens (S-PR2, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 "Customers = People ·
 * Dates · Money (one segmented control, the Suppliers/Guests shape)", § 4 NEW
 * item 2: "a `CustomersSegment` URL param (`?seg=people|dates|money`) — the
 * anchors module maps the old `#payday` / `?open=` landings onto it so every
 * existing link still lands").
 *
 * 🔑 A PLAIN MODULE, PURE. The page is a server component; this decides, from
 * the search params alone, which segment to draw — so a unit test can run every
 * old landing through it.
 *
 * ⚠ A FRAGMENT NEVER REACHES THE SERVER. `/customers#payday` arrives as a bare
 * `/customers` — so every landing that names a part of Money or Dates must carry
 * `?seg=` (the anchors table does) or a legacy `?tab=` / `?open=` key (the
 * redirect stubs and the folds do). Those keys are mapped here, ONCE.
 */

export const CUSTOMER_SEGMENTS = ['people', 'dates', 'money'] as const;
export type CustomersSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SEGMENT_LABEL: Readonly<Record<CustomersSegment, string>> = {
  people: 'People',
  dates: 'Dates',
  money: 'Money',
};

/**
 * Where each OLD key lives now. `open` is a fold's key (`?open=`); `tab` is the
 * alias the redirect stubs write (`/vendor-dashboard/calendar` → `?tab=calendar`).
 * One table for both — a fold and the stub that names it can never disagree.
 */
const LEGACY_HOME: Readonly<Record<string, CustomersSegment>> = {
  // People — the customers themselves, and the conversation with them.
  clients: 'people',
  messages: 'people',
  // Dates — the month, and the tools that shape it.
  calendar: 'dates',
  availability: 'dates',
  // Money — what is asked, agreed and paid.
  bookings: 'money',
  payday: 'money',
  proposals: 'money',
  contracts: 'money',
};

const one = (v: string | string[] | undefined): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : '';

/** The segment a URL opens. An unknown or missing one opens People. */
export function customersSegmentOf(sp: Record<string, string | string[] | undefined>): CustomersSegment {
  const seg = one(sp.seg);
  if ((CUSTOMER_SEGMENTS as readonly string[]).includes(seg)) return seg as CustomersSegment;
  const open = one(sp.open);
  if (open && LEGACY_HOME[open]) return LEGACY_HOME[open]!;
  const tab = one(sp.tab);
  if (tab && LEGACY_HOME[tab]) return LEGACY_HOME[tab]!;
  return 'people';
}

/** The folds the hub's one accordion holds — each drawn only under its own segment. */
const FOLD_KEYS = ['messages', 'proposals', 'contracts'] as const;

/** The fold keys that live in a segment (for the one accordion under it). */
export function foldsOf(seg: CustomersSegment): string[] {
  return FOLD_KEYS.filter((k) => LEGACY_HOME[k] === seg);
}

/** A segment's own address. People is the hub itself. */
export function customersSegmentHref(seg: CustomersSegment): string {
  return seg === 'people' ? '/vendor-dashboard/customers' : `/vendor-dashboard/customers?seg=${seg}`;
}
