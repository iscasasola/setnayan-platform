import { shopPath } from '@/lib/shop-address';
import type { VendorDay } from '@/lib/vendor-day-picker';
import { withVia, type MaterialVia } from '@/lib/material-tags';

/**
 * 🔳 THE SHOP'S QR CODES — the choices of the "Which code ▾" dropdown. Since 2026-11-05 the list is split between two
 * homes (Shop › Promote · Customers › QR codes — `PROMOTE_QR_MODES` below); each home's dropdown lists its own codes.
 *
 * Owner 2026-10-29 (DECISION_LOG "🔳 CORRECTS THE QR ROW ABOVE — THE QR DROPDOWN ALREADY EXISTS; EXTEND IT, DON'T
 * REDRAW IT"): keep the live dropdown (Shortlist · Booked) and ADD **Check a date** (after #7007 — shipped), **My page**
 * and **Crew for an event**. Under the dropdown, one large code — never a stack of codes (the row before it).
 *
 *   · My page  — the shop's own Setnayan page, `/<slug>`. The same address the day-of review code opens, without the
 *                `#reviews` jump (that one stays on the day-of page, where it asks guests for a review).
 *   · Crew     — pick the event → the event's ONE crew code (`vendor_crew_codes`, made in Hub › Crew). A scan lands the
 *                phone on that event's supplier Event Hub and waits for the supplier's Allow, which stays in Hub › Crew.
 *
 * Pure: the page reads, this decides. 🔒 lib/supplier-qr-codes.test.ts
 */
export const SUPPLIER_QR_MODES = ['shortlist', 'locked', 'dates', 'page', 'crew', 'reviews', 'gown'] as const;
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
 *
 * 🔳 OPTION B (owner 2026-11-06, *"B"* on the one-list prototype): Promote LISTS its four codes, one row each, in the
 * prototype's order — Check a date · Shortlist · My page · **Reviews** (the printed review code joined the list: the
 * prints and the list now pick from the same four). Booked · one-use and Crew stay per event on Customers › QR codes,
 * in the same row + sheet design.
 */
export const PROMOTE_QR_MODES = ['dates', 'shortlist', 'page', 'reviews'] as const satisfies readonly SupplierQrMode[];
export type PromoteQrMode = (typeof PROMOTE_QR_MODES)[number];
// 👗 Gown design (owner 26 Nov 2026): a design shared from the Gown Maker — Shortlist or Booked, made for one client.
export const CUSTOMERS_QR_MODES = ['locked', 'crew', 'gown'] as const satisfies readonly SupplierQrMode[];

/** Shop › Promote — where the shop's marketing codes live. */
export const PROMOTE_HREF = '/vendor-dashboard/shop/promote';
/** Customers › QR codes — Booked · one-use and Crew for an event. */
export const CUSTOMERS_QR_HREF = '/vendor-dashboard/invite';

/** 👗 Customers › QR codes › Gown design, its sheet open — the Gown Maker panel's "Share a design" door. */
export function gownShareHref(): string {
  return `${CUSTOMERS_QR_HREF}?mode=gown&open=1`;
}

export function isPromoteQrMode(mode: SupplierQrMode): mode is PromoteQrMode {
  return (PROMOTE_QR_MODES as readonly string[]).includes(mode);
}

/** `?mode=` on Shop › Promote → its code. Anything else is the Shortlist code. */
export function promoteQrModeOf(raw: unknown): PromoteQrMode {
  const m = supplierQrModeOf(raw);
  return isPromoteQrMode(m) ? m : 'shortlist';
}

/**
 * 🔳 MY QRs (owner 23 Nov 2026, verbatim: *"this also means we have to get cloud create a QR Page that will replace our
 * current QR page."* — DECISION_LOG "STORE DRAWING v13→v18 RULINGS" (1); drawing `supplier_store_graphs_badges_2026-11-23`
 * frames "My QRs" and "One QR, opened"). Every QR code the shop has, on ONE page under Shop; each code opens its own
 * page (the big code · Share · Copy link · Download · Write to NFC · Print it). It replaces Promote's QR part: the
 * Shop's QR sheet, the Promote page's QR section and every `?mode=` link now open here.
 */
export const MY_QRS_HREF = '/vendor-dashboard/shop/qrs';

/**
 * 🔗 "Name your shop first" lands on the field that makes the web address (final check A5-G4-06): Your details › Name
 * and logo, opened. It used to point at the Shop tab, which reloaded the page the supplier was already on.
 */
export const SHOP_NAME_SETUP_HREF = '/vendor-dashboard/profile#name';

/** The "Your shop" group, in the drawing's order: Your page · Reviews · Shortlist · Check a date. Same four codes. */
export const MY_QRS_SHOP_ORDER = ['page', 'reviews', 'shortlist', 'dates'] as const satisfies readonly PromoteQrMode[];

/** `/shop/qrs/<code>` → its code; anything else is no code (the page answers 404). */
export function myQrCodeOf(raw: unknown): PromoteQrMode | null {
  return typeof raw === 'string' && (PROMOTE_QR_MODES as readonly string[]).includes(raw) ? (raw as PromoteQrMode) : null;
}

/** One code's own page. Shortlist keeps its two picks (`et` · `cat`) in the address, as the Promote list did. */
export function myQrHref(mode: PromoteQrMode, picks: { et?: string | null; cat?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (mode === 'shortlist') {
    if (picks.et) q.set('et', picks.et);
    if (picks.cat) q.set('cat', picks.cat);
  }
  const s = q.toString();
  return `${MY_QRS_HREF}/${mode}${s ? `?${s}` : ''}`;
}

/**
 * 🖨 "Print it" — THIS code on the shop's prints (the old sheet's "Put it on…" · Door print · Prints). The prints still
 * live in Shop › Promote; the address hands the code (and the door piece) to its Prints section, which opens on it.
 * `QR designs` (the drawing's "QR templates" row, named by the controller 23 Nov) has no Toolkit shelf on main yet, so its
 * door is the same Prints section — never a dead link.
 */
export function printWithQrHref(mode: PromoteQrMode | null, piece: 'door' | null = null): string {
  const q = new URLSearchParams();
  if (mode) q.set('print', mode);
  if (mode && piece) q.set('piece', piece);
  const s = q.toString();
  return `${PROMOTE_HREF}${s ? `?${s}` : ''}#prints`;
}

/** Where a code lives — the one place every link to a code is built from. The shop's own codes open on My QRs. */
export function supplierQrHref(mode: SupplierQrMode): string {
  return isPromoteQrMode(mode) ? myQrHref(mode) : `${CUSTOMERS_QR_HREF}?mode=${mode}`;
}

/**
 * Each shop code's words (moved from `QrCodes`, 23 Nov — My QRs is their home now): the row's line is what a scan does;
 * the opened page shows it whole. `name` is the drawing's ("Your page", not "My page", on My QRs).
 */
export const MY_QR_WORDS: Readonly<Record<PromoteQrMode, { name: string; sub?: string; line: string; sheetLine: string; file: string; data: string }>> = {
  page: { name: 'Your page', line: 'They scan and open your Setnayan page', sheetLine: 'They scan and open your Setnayan page — your services, photos and reviews.', file: 'setnayan-my-page-qr.svg', data: 'my-page' },
  reviews: { name: 'Reviews', line: 'They scan and read your reviews', sheetLine: 'They scan and open your Setnayan page at its reviews.', file: 'setnayan-reviews-qr.svg', data: 'reviews' },
  shortlist: { name: 'Shortlist', sub: 'free', line: 'They scan, sign up free, and you join their shortlist', sheetLine: 'They scan, sign up free, and you join their shortlist.', file: 'setnayan-shortlist-qr.svg', data: 'shortlist' },
  dates: { name: 'Check a date', sub: 'free', line: 'They scan and see which days you can still be booked', sheetLine: 'They scan and see which days you can still be booked — never who booked or who is asking.', file: 'setnayan-check-a-date-qr.svg', data: 'check-a-date' },
};

export const SUPPLIER_QR_MODE_LABEL: Readonly<Record<SupplierQrMode, string>> = {
  shortlist: 'Shortlist · free',
  locked: 'Booked · one-use',
  dates: 'Check a date · free',
  page: 'My page',
  crew: 'Crew for an event',
  reviews: 'Reviews',
  gown: 'Gown design',
};

/** The page "My page" opens. `origin` has no trailing slash (`siteOrigin()`). */
export function myPagePath(slug: string): string {
  return `${shopPath(encodeURIComponent(slug))}`;
}
export function myPageUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, '')}${myPagePath(slug)}`;
}

/**
 * 💳 THE SUPPLIER'S OWN LINK (owner 2026-11-13, DECISION_LOG "THE SUPPLIER'S PERSONAL QR IS FREE; THEIR SHOP PAGE IS
 * CHARGED"; walk F-W1-58). The SAME page as `myPageUrl`, tagged `?src=own`, so an inquiry that arrives through the
 * supplier's QR, door sticker, print or share link is stamped `website` — their own client, no booking fee — while an
 * untagged arrival (somebody who found the shop on Setnayan) is `shop_page`, Setnayan-sourced. Every code or link the
 * SUPPLIER distributes is built here; a page Setnayan itself links to uses `myPageUrl`.
 *
 * 🏷 AND THE PIECE (owner 2026-11-16, DECISION_LOG "EVERY MATERIAL A SHOP HANDS OUT CARRIES ITS OWN TAG"): every own
 * address also names the material it is on — `?src=own&via=card` (`lib/material-tags.ts`). `via` is REQUIRED here so
 * no new code or link can be built without saying which piece it is.
 */
export const OWN_LINK_SRC = 'own';
export function ownPageUrl(origin: string, slug: string, via: MaterialVia): string {
  return withVia(`${myPageUrl(origin, slug)}?src=${OWN_LINK_SRC}`, via);
}
/** 💳 RW-19 (walk 13 Nov 2026): the supplier's own "Check a date" code — `/<slug>/dates`, tagged as theirs. */
export function ownDatesUrl(origin: string, slug: string, via: MaterialVia): string {
  return withVia(`${myPageUrl(origin, slug)}/dates?src=${OWN_LINK_SRC}`, via);
}
/** 💳 RW-19: the supplier's own "Reviews" code — `/<slug>/review`, tagged as theirs (the door keeps the tag). */
export function ownReviewsUrl(origin: string, slug: string, via: MaterialVia): string {
  return withVia(`${myPageUrl(origin, slug)}/review?src=${OWN_LINK_SRC}`, via);
}


/**
 * 💳 THE ONE RULE for what an arrival on the shop (or its Check-a-date page) is stamped when it asks (owner 2026-11-13,
 * walk F-W1-58 · RW-19): `?src=own` — the supplier's own code or link — is 'website', their own client; a Setnayan
 * surface's tag is that surface; NO tag found the shop on Setnayan → 'shop_page', sourced.
 *
 * 🔓 THE PIECE NEVER CHANGES THIS (owner 2026-11-16, DECISION_LOG "EVERY VERIFIED ACCOUNT GETS THE QR FEATURES, ON ANY
 * PLAN", which superseded "only Supplier Ultra's prints are the shop's own"): a printed card, a tarp, the door sticker
 * and a shared link are all the shop's own code on every plan. Whether that own arrival is really the shop's own
 * client is decided at the inquiry, from the shop's verification read THEN (`ownLinkArrival` in
 * `lib/own-clients.server.ts`): an unverified shop's scan is 'shop_page', Setnayan-sourced.
 */
export function arrivalInquirySourceOf(src: unknown): 'website' | 'editorial' | 'favorites' | 'explore' | 'search' | 'shop_page' {
  if (src === OWN_LINK_SRC) return 'website';
  if (src === 'editorial' || src === 'favorites' || src === 'explore' || src === 'search') return src;
  return 'shop_page';
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
