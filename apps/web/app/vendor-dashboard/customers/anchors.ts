/**
 * Where a folded route lands on the My Customers hub (S43 · 3).
 *
 * `/vendor-dashboard/bookings` and `/vendor-dashboard/calendar` are redirect
 * stubs into this one page. Without a fragment they reloaded it at the top, so
 * a link that named Bookings or the calendar showed the roster instead. Each
 * fragment here must match an `id` rendered by `customers/page.tsx` —
 * `anchors-land.test.ts` holds the two together.
 */
export const BOOKINGS_ANCHOR = '#bookings';
export const CALENDAR_ANCHOR = '#calendar';
/**
 * Where the hub's folds open (`<FeatureAccordion>` lives inside this id). One
 * id, rendered by whichever segment is on screen — each segment keeps the folds
 * that are its own (`SECTION_SEGMENT`).
 */
export const CUSTOMER_TOOLS_ANCHOR = '#customer-tools';
/** The always-on cash-flow timeline (not a fold). */
export const PAYDAY_ANCHOR = '#payday';

const HUB = '/vendor-dashboard/customers';

/*
  ── CUSTOMERS IS THREE SEGMENTS (supplier redesign S-PR2, 2026-10-10) ────────
  People · Dates · Money — one page, three views of the same bookings (corpus
  `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3; prototype frame 03).
  The segment is `?seg=`, and ONE table here says which segment every id and
  every fold lives on, so a link, a redirect stub and the page can never put the
  same thing in two places.

  🔑 A FRAGMENT IS INVISIBLE TO THE SERVER. `…/customers#payday` reaches the
  page as `…/customers`, which is People — where `#payday` does not exist, and a
  fragment link to a missing id scrolls nowhere and throws nothing. So:
    · every link THIS APP builds to an id on another segment carries the
      segment (`customerLandingHref('payday')` → `?seg=money#payday`);
    · a redirect stub names its section in `?tab=` (they always did), and
      `customersSegment` reads that;
    · a link somebody saved before today (a notification, an email) is caught
      in the browser by `SegmentHashLander`, which reads `ANCHOR_SEGMENT`.
*/
export const CUSTOMER_SEGMENTS = ['people', 'dates', 'money'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];
export const CUSTOMER_SEGMENT_LABEL: Record<CustomerSegment, string> = {
  people: 'People',
  dates: 'Dates',
  money: 'Money',
};

/** Which segment renders each id on the hub. `anchors-land.test.ts` holds it against the page. */
export const ANCHOR_SEGMENT: Record<string, CustomerSegment> = {
  '#customers': 'people',
  '#calendar': 'dates',
  '#bookings': 'money',
  '#payday': 'money',
};

/**
 * Which segment a section's key lands on — the hub's own folds (`?open=`), and
 * the words the redirect stubs and older links still say in `?tab=`.
 *
 * `clients` is the retired "Book of business" fold: its three lists ARE the
 * People list now, so the old key lands on People.
 */
export const SECTION_SEGMENT: Record<string, CustomerSegment> = {
  messages: 'people',
  clients: 'people',
  availability: 'dates',
  calendar: 'dates',
  bookings: 'money',
  payday: 'money',
  proposals: 'money',
  contracts: 'money',
};

function one(v: string | string[] | undefined): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * The segment a request is for: `?seg=` when it names one, else the segment of
 * the section it names (`?open=` first, then the stubs' `?tab=`), else People.
 */
export function customersSegment(sp: Record<string, string | string[] | undefined>): CustomerSegment {
  const seg = one(sp.seg);
  if (seg && (CUSTOMER_SEGMENTS as readonly string[]).includes(seg)) return seg as CustomerSegment;
  for (const key of [one(sp.open), one(sp.tab)]) {
    if (key && SECTION_SEGMENT[key]) return SECTION_SEGMENT[key]!;
  }
  return 'people';
}

/** The link a segment's own tab goes to. People is the bare page. */
export function customersSegmentHref(seg: CustomerSegment): string {
  return seg === 'people' ? HUB : `${HUB}?seg=${seg}`;
}

/**
 * The four sections the supplier's phone names by their own words — Messages,
 * Earnings & payday, Send quote, Send contract — and where each one IS on the
 * hub. ONE table, read by the More rows, Today's tiles, the Next card AND the
 * redirect stubs, so a link and a stub can never land in two places.
 *
 * 🔑 `fold` is the `?open=` key of a FeatureAccordion section (the same keys the
 * roster's ⋯ menu uses); `payday` has none because it is not a fold — it is
 * always on the page, so only its fragment is needed.
 */
export const CUSTOMER_LANDINGS = {
  messages: { fold: 'messages', anchor: CUSTOMER_TOOLS_ANCHOR },
  payday: { fold: null, anchor: PAYDAY_ANCHOR },
  proposals: { fold: 'proposals', anchor: CUSTOMER_TOOLS_ANCHOR },
  contracts: { fold: 'contracts', anchor: CUSTOMER_TOOLS_ANCHOR },
} as const;

/**
 * The segment a landing is on. A FOLD's segment comes from its `?open=` key,
 * which the server can see; `payday` has no key — only a fragment — so its link
 * must carry `?seg=` itself.
 */
export function customerLandingSegment(key: keyof typeof CUSTOMER_LANDINGS): CustomerSegment {
  const { fold, anchor } = CUSTOMER_LANDINGS[key];
  return (fold ? SECTION_SEGMENT[fold] : ANCHOR_SEGMENT[anchor]) ?? 'people';
}

export type CustomerLanding = keyof typeof CUSTOMER_LANDINGS;

/** The fragment alone — what a redirect stub appends (it already carries `?tab=`). */
export function customerLandingAnchor(key: CustomerLanding): string {
  return CUSTOMER_LANDINGS[key].anchor;
}

/** The full link: opens the fold, in view. Never the bare roster. */
export function customerLandingHref(key: CustomerLanding): string {
  const { fold, anchor } = CUSTOMER_LANDINGS[key];
  // A fold names its own segment through `?open=`; a bare fragment cannot.
  const seg = customerLandingSegment(key);
  const query = fold ? `?open=${fold}` : seg === 'people' ? '' : `?seg=${seg}`;
  return `${HUB}${query}${anchor}`;
}
