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
/** Where the hub's folds open (`<FeatureAccordion>` lives inside this id). */
export const CUSTOMER_TOOLS_ANCHOR = '#customer-tools';
/** The always-on cash-flow timeline (not a fold). */
export const PAYDAY_ANCHOR = '#payday';

const HUB = '/vendor-dashboard/customers';

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

export type CustomerLanding = keyof typeof CUSTOMER_LANDINGS;

/** The fragment alone — what a redirect stub appends (it already carries `?tab=`). */
export function customerLandingAnchor(key: CustomerLanding): string {
  return CUSTOMER_LANDINGS[key].anchor;
}

/** The full link: opens the fold, in view. Never the bare roster. */
export function customerLandingHref(key: CustomerLanding): string {
  const { fold, anchor } = CUSTOMER_LANDINGS[key];
  return `${HUB}${fold ? `?open=${fold}` : ''}${anchor}`;
}
