/**
 * lib/pricing-elsewhere.ts — WHAT OTHER EVENT SITES CHARGE, the only figures on /pricing that are NOT ours.
 *
 * Owner 2026-10-25, verbatim: *"make sure they see that while Other websites pay for these services, we give it for
 * free. And only pay what you need to upgrade."* Approved prototype
 * `prototypes/pricing_free_plus_addons_2026-10-25/index.html` (corpus 20b2a55c, revision 4).
 *
 * 🔑 THESE ARE FACTS ABOUT OTHER SITES, NOT PRICES OF OURS. Every peso Setnayan charges is a `platform_retail_catalog_v2`
 * row read at render; nothing here is ever charged, compared against our catalogue, or written into an order. Each
 * figure carries the page it was read from and the day it was read, because a competitor's price changes without
 * telling us — re-read the source before trusting a figure after `readOn`.
 *
 * 🚫 NO COMPETITOR IS NAMED ON THE PAGE (the /features registry rule "No competitor names"). The source URLs live here
 * for whoever re-checks a figure; the page renders only the numbers. Guard: `pricing-elsewhere.test.ts` (every figure
 * has an https source and a read date) and `app/(shell)/pricing/pricing-free-plus-addons.test.ts` (no competitor's name
 * or domain on the page).
 *
 * Figures are plain numbers, never typed "₱…" strings — the page formats them.
 */

/** The day every figure below was read off its source page. */
export const ELSEWHERE_READ_ON = '2026-10-25';

export type ElsewhereFact = {
  /** What the figure is, in our words. */
  what: string;
  /** The figure itself (pesos, or a guest count — see `unit`). */
  value: number;
  unit: 'php' | 'guests';
  /** The page(s) the figure was read from. */
  sources: readonly string[];
  /** The day it was read. */
  readOn: string;
};

export const ELSEWHERE = {
  /** A full event site with unlimited guests, one-time. */
  siteFull: {
    what: 'event site, full version with unlimited guests (one-time)',
    value: 2499,
    unit: 'php',
    sources: ['https://useceremo.com/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
  /** A second full event site's premium, one-time — the low end of "about ₱2,500". */
  siteFullAlt: {
    what: 'event site premium (one-time)',
    value: 2460,
    unit: 'php',
    sources: ['https://invitecount.com/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
  /** Free plans' guest caps: the low end … */
  freeGuestCapLow: {
    what: 'free plan guest cap (low end)',
    value: 30,
    unit: 'guests',
    sources: ['https://invitecount.com/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
  /** … and the high end. */
  freeGuestCapHigh: {
    what: 'free plan guest cap (high end)',
    value: 50,
    unit: 'guests',
    sources: ['https://useceremo.com/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
  /** A seating chart's free trial stops here; 3D seating is enterprise-only elsewhere. */
  seatingTrialGuests: {
    what: 'seating chart free up to this many guests, then paid; 3D seating on enterprise plans only',
    value: 15,
    unit: 'guests',
    sources: [
      'https://www.zola.com/faq/360038917171-How-do-I-use-the-Zola-seating-chart-',
      'https://www.socialtables.com/pricing',
    ],
    readOn: ELSEWHERE_READ_ON,
  },
  /** A one-camera livestream for one event (personal plan) — the high end. */
  livestreamPersonal: {
    what: 'livestream, one event, personal plan',
    value: 2990,
    unit: 'php',
    sources: ['https://eventlive.pro/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
  /** The same, per business event — the low end. */
  livestreamBusiness: {
    what: 'livestream, per business event',
    value: 2690,
    unit: 'php',
    sources: ['https://eventlive.pro/pricing'],
    readOn: ELSEWHERE_READ_ON,
  },
} as const satisfies Record<string, ElsewhereFact>;

/**
 * Door check-in elsewhere comes only with a paid plan (no per-event peso figure to quote — the page says so in words).
 * Kept as a fact so its source is on file like the rest.
 */
export const ELSEWHERE_CHECKIN_PAID_PLAN: Omit<ElsewhereFact, 'value' | 'unit'> = {
  what: 'guest check-in sold only with a paid annual plan',
  sources: ['https://www.paperlesspost.com/pricing'],
  readOn: ELSEWHERE_READ_ON,
};

/** "about ₱2,500" — a figure rounded to the nearest ₱100, the way the page says an "about". */
export function aboutPhp(value: number): number {
  return Math.round(value / 100) * 100;
}

/**
 * "at least ₱5,489 elsewhere" — the two PER-EVENT consumer prices that were actually read: a full site with unlimited
 * guests plus a one-camera livestream. Seating and check-in are sold elsewhere as business subscriptions, so they are
 * deliberately NOT summed (the page marks them "extra").
 */
export function elsewhereOneEventPhp(): number {
  return ELSEWHERE.siteFull.value + ELSEWHERE.livestreamPersonal.value;
}
