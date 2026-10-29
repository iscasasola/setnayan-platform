/**
 * Customers = Events · Dates · Money — which one a URL opens (S-PR2, corpus
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

/*
  🗂 CUSTOMERS ARE EVENTS, NOT PEOPLE (owner 2026-10-29, DECISION_LOG "CUSTOMERS ARE EVENTS, NOT PEOPLE": *"is the they
  event the customer and not just the people? because a people can have multiple events? and in one event, can have
  multiple cohost?"* ⇒ "Customers' first section is EVENTS"; re-reported 2026-10-30: *"supplier dashboard>Customers still
  show people and not events"*). The first view's key and word are `events` / "Events".

  ⏭ QR is the ruling's fourth section, but it is not drawn here: the QR codes are their own page today
  (`/vendor-dashboard/invite`, reached from Dates), and making them a Customers section is the S4 build. A ▾ choice that
  leaves Customers would be a door to another page dressed as a section.
*/
export const CUSTOMER_SEGMENTS = ['events', 'dates', 'money'] as const;
export type CustomersSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SEGMENT_LABEL: Readonly<Record<CustomersSegment, string>> = {
  events: 'Events',
  dates: 'Dates',
  money: 'Money',
};

/**
 * 🔀 THE OLD ADDRESS. `?seg=people` was the first view's address until 2026-10-30; every link, bookmark and form already
 * open in a browser that still names it lands on Events. The page forwards it (`oldPeopleAddressForward`), and
 * `customersSegmentOf` reads it as Events in the meantime, so no caller can draw a blank view from it.
 */
export const OLD_PEOPLE_SEG = 'people';

/**
 * Where an address that still says `?seg=people` goes: the same address without it (Events is the hub itself), every
 * other param and its order kept. Null when the address does not name the old view — nothing to forward.
 */
export function oldPeopleAddressForward(sp: Record<string, string | string[] | undefined>): string | null {
  if (one(sp.seg) !== OLD_PEOPLE_SEG) return null;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'seg' || v === undefined) continue;
    for (const each of Array.isArray(v) ? v : [v]) params.append(k, each);
  }
  const rest = params.toString();
  return `/vendor-dashboard/customers${rest ? `?${rest}` : ''}`;
}

/**
 * Where each OLD key lives now. `open` is a fold's key (`?open=`); `tab` is the
 * alias the redirect stubs write (`/vendor-dashboard/calendar` → `?tab=calendar`).
 * One table for both — a fold and the stub that names it can never disagree.
 */
const LEGACY_HOME: Readonly<Record<string, CustomersSegment>> = {
  // Events — the customers' events themselves, and the one chat each.
  clients: 'events',
  messages: 'events',
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

/** The segment a URL opens. An unknown or missing one — and the old `?seg=people` — opens Events. */
export function customersSegmentOf(sp: Record<string, string | string[] | undefined>): CustomersSegment {
  const seg = one(sp.seg);
  if ((CUSTOMER_SEGMENTS as readonly string[]).includes(seg)) return seg as CustomersSegment;
  if (seg === OLD_PEOPLE_SEG) return 'events';
  const open = one(sp.open);
  if (open && LEGACY_HOME[open]) return LEGACY_HOME[open]!;
  const tab = one(sp.tab);
  if (tab && LEGACY_HOME[tab]) return LEGACY_HOME[tab]!;
  return 'events';
}

/** The folds the hub's one accordion holds — each drawn only under its own segment. */
/** 🗑 `messages` left 2026-10-28 — the event list IS the messages (each Events row opens its chat). */
const FOLD_KEYS = ['bookings', 'proposals', 'contracts'] as const;

/** The fold keys that live in a segment (for the one accordion under it). */
export function foldsOf(seg: CustomersSegment): string[] {
  return FOLD_KEYS.filter((k) => LEGACY_HOME[k] === seg);
}

/** A segment's own address. Events is the hub itself. */
export function customersSegmentHref(seg: CustomersSegment): string {
  return seg === 'events' ? '/vendor-dashboard/customers' : `/vendor-dashboard/customers?seg=${seg}`;
}

/**
 * Events' four doors — Asking · Talking · Booked · Done (owner 2026-10-28, prototype `custRows()`), drawn by
 * `CustomersPin`. Here, in the neutral module, because a server page reads the list itself.
 */
export type CustomersDoorKey = 'asking' | 'talking' | 'booked' | 'done';
export const CUSTOMERS_DOORS: readonly CustomersDoorKey[] = ['asking', 'talking', 'booked', 'done'];

/** Every view's own address, as strings (a client row cannot be handed a function). */
export const CUSTOMER_SEGMENT_HREFS: Readonly<Record<CustomersSegment, string>> = {
  events: customersSegmentHref('events'),
  dates: customersSegmentHref('dates'),
  money: customersSegmentHref('money'),
};
