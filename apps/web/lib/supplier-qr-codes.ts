import type { VendorDay } from '@/lib/vendor-day-picker';

/**
 * 🔳 THE SHOP'S QR CODES — the choices of the "Which code ▾" dropdown. Since 2026-11-05 the list is split between two
 * homes (Shop › Promote · Customers › QR codes — `PROMOTE_QR_MODES` below); each home's dropdown lists its own codes.
 *
 * Owner 2026-10-29 (DECISION_LOG "🔳 CORRECTS THE QR ROW ABOVE — THE QR DROPDOWN ALREADY EXISTS; EXTEND IT, DON'T
 * REDRAW IT"): keep the live dropdown (Shortlist · Booked) and ADD **Check a date** (after #7007 — shipped), **My page**
 * and **Crew for an event**. Under the dropdown, one large code — never a stack of codes (the row before it).
 *
 *   · My page  — the shop's own Setnayan page, `/v/<slug>`. The same address the day-of review code opens, without the
 *                `#reviews` jump (that one stays on the day-of page, where it asks guests for a review).
 *   · Crew     — pick the event → the event's ONE crew code (`vendor_crew_codes`, made in Hub › Crew). A scan lands the
 *                phone on that event's supplier Event Hub and waits for the supplier's Allow, which stays in Hub › Crew.
 *
 * Pure: the page reads, this decides. 🔒 lib/supplier-qr-codes.test.ts
 */
export const SUPPLIER_QR_MODES = ['shortlist', 'locked', 'dates', 'page', 'crew'] as const;
export type SupplierQrMode = (typeof SUPPLIER_QR_MODES)[number];

/** `?mode=` → the code to show. Anything unknown is the Shortlist code, as before this list grew. */
export function supplierQrModeOf(raw: unknown): SupplierQrMode {
  return typeof raw === 'string' && (SUPPLIER_QR_MODES as readonly string[]).includes(raw) ? (raw as SupplierQrMode) : 'shortlist';
}

/**
 * 📣 SHOP › PROMOTE (owner 2026-11-05): the codes that MARKET the shop leave Customers and live in Shop › Promote, beside
 * the website, print materials and gifts — one place for every marketing tool (owner, verbatim: "So the location of our
 * for page is correct" — the For Suppliers page already presents them that way). Same codes, same words, new home.
 *
 *   · PROMOTE   — Shortlist · free · Check a date · free · My page   → `/vendor-dashboard/shop/promote`
 *   · CUSTOMERS — Booked · one-use (one customer's deal; moves onto the customer card in a later part) · Crew for an
 *                 event (Hub › Crew's code)                            → `/vendor-dashboard/invite`
 *
 * The two lists split SUPPLIER_QR_MODES exactly — every code has ONE home (🔒 lib/supplier-qr-codes.test.ts).
 */
export const PROMOTE_QR_MODES = ['shortlist', 'dates', 'page'] as const satisfies readonly SupplierQrMode[];
export type PromoteQrMode = (typeof PROMOTE_QR_MODES)[number];
export const CUSTOMERS_QR_MODES = ['locked', 'crew'] as const satisfies readonly SupplierQrMode[];

/** Shop › Promote — where the shop's marketing codes live. */
export const PROMOTE_HREF = '/vendor-dashboard/shop/promote';
/** Customers › QR codes — Booked · one-use and Crew for an event. */
export const CUSTOMERS_QR_HREF = '/vendor-dashboard/invite';

export function isPromoteQrMode(mode: SupplierQrMode): mode is PromoteQrMode {
  return (PROMOTE_QR_MODES as readonly string[]).includes(mode);
}

/** `?mode=` on Shop › Promote → its code. Anything else is the Shortlist code. */
export function promoteQrModeOf(raw: unknown): PromoteQrMode {
  const m = supplierQrModeOf(raw);
  return isPromoteQrMode(m) ? m : 'shortlist';
}

/** Where a code lives, with its `?mode=` — the one place every link to a code is built from. */
export function supplierQrHref(mode: SupplierQrMode): string {
  return `${isPromoteQrMode(mode) ? PROMOTE_HREF : CUSTOMERS_QR_HREF}?mode=${mode}`;
}

export const SUPPLIER_QR_MODE_LABEL: Readonly<Record<SupplierQrMode, string>> = {
  shortlist: 'Shortlist · free',
  locked: 'Booked · one-use',
  dates: 'Check a date · free',
  page: 'My page',
  crew: 'Crew for an event',
};

/** The page "My page" opens. `origin` has no trailing slash (`siteOrigin()`). */
export function myPagePath(slug: string): string {
  return `/v/${encodeURIComponent(slug)}`;
}
export function myPageUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, '')}${myPagePath(slug)}`;
}

export type CrewQrEvent = { eventId: string; label: string };

/**
 * The events a crew code can be for: every event this shop is on TODAY or AHEAD — one entry per event (a two-day
 * event is one crew code), nearest first. A past event's crew pass has ended, so it is not offered.
 *
 * @param days  every booked (event, day), in any order (`fetchVendorRoomEvents`).
 * @param today `YYYY-MM-DD` in Manila — injected, never read from a clock.
 * @param dayWords how a day is said (`hubDayWords`) — injected so this stays pure.
 */
export function crewQrEvents(days: readonly VendorDay[], today: string, dayWords: (iso: string) => string | null): CrewQrEvent[] {
  const first = new Map<string, VendorDay>();
  for (const d of [...days].sort((a, b) => a.bookedDate.localeCompare(b.bookedDate))) {
    if (d.bookedDate < today) continue;
    if (!first.has(d.eventId)) first.set(d.eventId, d);
  }
  return [...first.values()].map((d) => {
    const when = d.bookedDate === today ? 'Today' : dayWords(d.bookedDate);
    const name = d.eventName.trim() || 'An event';
    return { eventId: d.eventId, label: when ? `${name} · ${when}` : name };
  });
}

/** Which event the crew code is for: the one asked for when it is in the list, else the nearest. */
export function pickCrewQrEvent(list: readonly CrewQrEvent[], asked: string | null | undefined): CrewQrEvent | null {
  return list.find((e) => e.eventId === asked) ?? list[0] ?? null;
}
