/**
 * lib/maker-details-items.ts — the ITEMS of the Maker's Details page, and how
 * an address picks one (owner 2026-09-28: "THE DETAILS PAGE WEARS THE MAKER'S
 * THREE COLUMNS" + "PRINTS & TICKETS FOLDS INTO DETAILS").
 *
 * Details is a navigator of items — the Event Hub's own (theme, address, QR),
 * every piece of the invitation set, and the free prints for the day — each
 * with its picture in the body and its editor beside it. Pure: no I/O, no
 * React, so the rules are held as functions.
 *
 * ── OLD LINKS LAND ON THE SAME PIECE ───────────────────────────────────────
 * Prints & Tickets was its own Maker page (`?tool=prints`). It is now Details,
 * so every old address resolves here: `?tool=prints` → Details (its size
 * params are kept by the caller — they are read as they always were);
 * `print_theme` → the Theme item; the Menu editor's save flash → the Menu;
 * nothing named → the first print. `?tool=details&item=<key>` names one.
 */
import { PRINT_SET_KEYS, type PrintSetKey } from '@/lib/print-pieces';
import type { FreePrint } from '@/lib/free-prints';

export type HubItemKey = 'theme' | 'address' | 'qr';
export type FreePrintKey = FreePrint['key'];
export type DetailsItemKey = HubItemKey | PrintSetKey | FreePrintKey;

export const HUB_ITEM_KEYS: readonly HubItemKey[] = ['theme', 'address', 'qr'];
export const FREE_PRINT_KEYS: readonly FreePrintKey[] = [
  'guest-registry',
  'qr-codes',
  'seat-plan',
  'seating-pack',
  'caterer',
  'event-qr',
];

export type DetailsItemGroup = 'hub' | 'set' | 'day';
export const DETAILS_ITEM_GROUPS: ReadonlyArray<{ group: DetailsItemGroup; keys: readonly DetailsItemKey[] }> = [
  { group: 'hub', keys: HUB_ITEM_KEYS },
  { group: 'set', keys: PRINT_SET_KEYS },
  { group: 'day', keys: FREE_PRINT_KEYS },
];

export const DETAILS_ITEM_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.flatMap((g) => g.keys);

export function isDetailsItemKey(v: unknown): v is DetailsItemKey {
  return typeof v === 'string' && (DETAILS_ITEM_KEYS as readonly string[]).includes(v);
}

/** Details opens on its first item; an old Prints & Tickets link on the first print. */
export const DETAILS_FIRST_ITEM: DetailsItemKey = 'theme';
export const DETAILS_FIRST_PRINT: DetailsItemKey = PRINT_SET_KEYS[0];

/**
 * Which Maker page an old `?tool=` means now — Prints & Tickets is Details.
 * Anything else is returned as it came.
 */
export function makerToolFor(tool: string | null | undefined): string | null {
  if (!tool) return null;
  return tool === 'prints' ? 'details' : tool;
}

/**
 * The item a Details address opens. `tool` is the RAW `?tool=` (before
 * `makerToolFor`), so an old Prints & Tickets link is told apart.
 */
export function detailsItemFor(search: {
  tool?: string | null;
  item?: string | null;
  printTheme?: string | null;
  menuFlash?: boolean;
}): DetailsItemKey {
  if (isDetailsItemKey(search.item)) return search.item;
  if (search.menuFlash) return 'menu';
  if (search.printTheme) return 'theme';
  return search.tool === 'prints' ? DETAILS_FIRST_PRINT : DETAILS_FIRST_ITEM;
}

/** The address of one item — every link into Details names its item this way. */
export function detailsItemHref(eventId: string, item: DetailsItemKey, extra = ''): string {
  return `/dashboard/${eventId}/launch?tool=details&item=${item}${extra}`;
}
