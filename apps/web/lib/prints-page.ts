/**
 * lib/prints-page.ts — 🖨 PRINTS LEAVES STUDIO: ITS OWN PAGE, AND A PRINTS LINE ON HOME (owner 2026-10-27, verbatim:
 * *"Prints leaves Studio. It keeps its own page (the approved swipe carousel) and Home gets a Prints line that opens it.
 * No new bottom tab."* — DECISION_LOG "PRINTS LEAVES STUDIO …", corpus 6bc60ed4; build plan step R8).
 *
 *   · THE PAGE is `/dashboard/<id>/prints` (`printsPageHref`). It renders the SHIPPED Prints workspace whole — the Maker's
 *     one Details page on its Prints form, the swipe carousel (`studio-prints-carousel.tsx`), ⚙ Print settings, Download ▾,
 *     View as ▾, every save — through the Maker's own page (`launch/page.tsx`), told by `PRINTS_PAGE_SURFACE`. Nothing is
 *     redrawn; the Maker's top bar keeps ↶ · ✓ (✕ dropped by Event Hub Pro) and names the page "Prints" where Stages | Studio stood.
 *   · HOME HOLDS THE DOOR, NEVER THE TOOL: one Prints line (`PRINTS_HOME_LINE`, ⓘ `PRINTS_PAGE_CARD`) that opens the page.
 *   · EVERY OLD DOOR FORWARDS (owner 2026-10-28, *"all mapping will be kept"*): an address of the Maker that names a print —
 *     `?tool=prints`, `?tool=details&item=<print>`, `?item=every-print` — lands on the page at the same piece, carrying its
 *     query (`printsForward`). The Studio tile and the Maker's Prints doors are gone.
 *
 * Pure: no I/O, no React. Held by `lib/prints-has-its-own-page.test.ts`.
 */
import { EVERY_PRINT_ITEM, detailsItemFor, isDetailsItemKey, isPrintsItem, type DetailsItemKey } from './maker-details-items';
import { printsPageHref } from './prints-page-href';

export { PRINTS_PAGE_LABEL, printsPageHref } from './prints-page-href';

/**
 * 🔑 How the Prints page tells the Maker's page it is drawing Prints alone — a key on the `searchParams` object it HANDS
 * the Maker's page (`prints/page.tsx` → `LaunchHubPage`). A Symbol, never a query word: no address can carry it, so
 * `/launch?anything` can never open the Maker as the Prints page — and the Maker's page forwards every print address,
 * while the Prints page is never forwarded. `Symbol.for`, so the two route bundles name the same key.
 */
export const PRINTS_PAGE_SURFACE: unique symbol = Symbol.for('setnayan.prints-page');

/** Is this `searchParams` object the one the Prints page handed over? */
export function isPrintsPageSurface(search: object | null | undefined): boolean {
  return Boolean(search) && (search as Record<symbol, unknown>)[PRINTS_PAGE_SURFACE] === true;
}

/**
 * The print the page opens: the one the address names, else the head of the form — "On every print", then the
 * Invitation (owner 2026-10-16; it is where the Studio tile opened, `STUDIO_TILE_ITEM.prints` until R8). The Menu
 * editor's save comes back to the Menu.
 */
export function printsPageItem(search: { item?: string | null; menuFlash?: boolean }): DetailsItemKey {
  if (isDetailsItemKey(search.item) && isPrintsItem(search.item)) return search.item;
  if (search.menuFlash) return 'menu';
  return EVERY_PRINT_ITEM;
}

/**
 * 🚪 THE FORWARD — the print an old Maker address opens, or null where it opens no print (it stays in the Maker).
 * The SAME `detailsItemFor` the Maker resolves an address with, so a forward and the Maker never disagree about
 * which item an address names: `?tool=prints` → the first print · `?tool=details&item=menu` → the Menu ·
 * `?item=every-print` → "On every print" · `?tool=prints&print_theme=…` → Look's Background (not a print: stays).
 */
export function printsForward(search: {
  tool?: string | null;
  item?: string | null;
  printTheme?: string | null;
  menuFlash?: boolean;
}): DetailsItemKey | null {
  if (!search.tool && !search.item) return null;
  const item = detailsItemFor(search);
  return isPrintsItem(item) ? item : null;
}

/** The query words a print address carries on to the page — a save's flash, a picked size, View as, a draft bounce. */
export const PRINTS_PAGE_CARRY = [
  'print_saved',
  'print_error',
  'menu_saved',
  'menu_error',
  'pass_format',
  'invitation_format',
  'card_format',
  'draft_error',
  'viewas',
] as const;

/** The forward's whole address: the page, at the print, with the words it carries (`PRINTS_PAGE_CARRY`). */
export function printsForwardHref(eventId: string, item: DetailsItemKey, search: Readonly<Record<string, unknown>>): string {
  const extra = PRINTS_PAGE_CARRY.flatMap((k) => {
    const v = search[k];
    return typeof v === 'string' && v.length > 0 ? [`${k}=${encodeURIComponent(v)}`] : [];
  }).join('&');
  return printsPageHref(eventId, item, extra);
}

/** 🏠 Home's Prints line — its name is `PRINTS_PAGE_LABEL`; its one short line, what the page holds. */
export const PRINTS_HOME_LINE = 'Invitation set · for the day';

/**
 * ⓘ What the Prints line's tip explains (moved whole from the Studio card's `prints` entry, `lib/studio-page-cards.ts`,
 * which went with the tile): what the page controls · where a guest sees it · what to do first.
 */
export const PRINTS_PAGE_CARD = {
  description: 'The invitation set and the printed pieces for the day.',
  /* The pieces that SHIP (`lib/print-pieces.ts`) — never an RSVP card or programmes, which do not. */
  controls: 'The invitation, the entourage, the details card, the menu, passes, posters, and table signs and place cards — each as a file to print.',
  seenAt: 'In the hands of your guests and on the tables.',
  first: 'Download the invitation once your names and Look are done; it carries both.',
} as const;
