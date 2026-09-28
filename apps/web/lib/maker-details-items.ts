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

export type HubItemKey = 'address' | 'qr';
/**
 * Details part 2a — "Your event" (owner 2026-09-28, DECISION_LOG "OPTION B…"):
 * Names · Date · Venues · Parents & hosts · the march. Which of them an event
 * shows is decided per event type (`lib/details-your-event.ts`), never here.
 */
export type EventItemKey = 'names' | 'date' | 'venues' | 'parents' | 'march';
export const EVENT_ITEM_KEYS: readonly EventItemKey[] = ['names', 'date', 'venues', 'parents', 'march'];
export type FreePrintKey = FreePrint['key'];
/** The whole invitation set in one download — every piece, every guest's pass. */
export type DownloadItemKey = 'download';
export type DetailsItemKey = 'theme' | EventItemKey | HubItemKey | PrintSetKey | FreePrintKey | DownloadItemKey;

export const HUB_ITEM_KEYS: readonly HubItemKey[] = ['address', 'qr'];
export const FREE_PRINT_KEYS: readonly FreePrintKey[] = [
  'guest-registry',
  'qr-codes',
  'seat-plan',
  'seating-pack',
  'caterer',
  'event-qr',
];

/**
 * The navigator's groups, in the owner's FINAL order (2026-09-28, DECISION_LOG
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS…"):
 *
 *   Look (Theme · Logo · Hero · Reveal) · Your event · Words · Story & plans
 *   (Love Story · Schedule · RSVP) · Your Event Hub (Address · QR) ·
 *   Invitation set · For the day · Download the set
 *
 * DATA, not markup. Part 1 (this build) fills Theme, Your Event Hub, the
 * Invitation set, For the day and Download; Details parts 2 and 3 add their
 * items to these rows (and their bodies and editors) — nothing else moves. A
 * group with no items yet is simply not drawn.
 */
export type DetailsItemGroup = 'look' | 'event' | 'words' | 'story' | 'hub' | 'set' | 'day' | 'download';
export const DETAILS_ITEM_GROUPS: ReadonlyArray<{ group: DetailsItemGroup; label: string; keys: readonly DetailsItemKey[] }> = [
  { group: 'look', label: 'Look', keys: ['theme'] },
  { group: 'event', label: 'Your event', keys: EVENT_ITEM_KEYS },
  { group: 'words', label: 'Words', keys: [] },
  { group: 'story', label: 'Story & plans', keys: [] },
  { group: 'hub', label: 'Your Event Hub', keys: HUB_ITEM_KEYS },
  { group: 'set', label: 'Invitation set', keys: PRINT_SET_KEYS },
  { group: 'day', label: 'For the day', keys: FREE_PRINT_KEYS },
  { group: 'download', label: 'Download the set', keys: ['download'] },
];

export const DETAILS_ITEM_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.flatMap((g) => g.keys);

export function isDetailsItemKey(v: unknown): v is DetailsItemKey {
  return typeof v === 'string' && (DETAILS_ITEM_KEYS as readonly string[]).includes(v);
}

/** Details opens on its first item — Theme, the first choice (owner-approved
 *  prototype); an old Prints & Tickets link on the first print. */
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
/**
 * ONE ITEM, AS THE NAVIGATOR DRAWS IT — every builder's items carry the same
 * shape: its label, its small picture, whether it is DONE (derived from data
 * that already exists — never a new column), and where it is USED (the stages
 * and prints that read it).
 */
export type DetailsItemModel = {
  key: DetailsItemKey;
  group: DetailsItemGroup;
  label: string;
  sub?: string;
  /** Filled in, as the data already says — undefined when "done" means nothing for it. */
  done?: boolean;
  /** Where it shows — "Every stage", "The Invitation", "Every pass". */
  usedOn?: readonly string[];
};

export function groupOfItem(key: DetailsItemKey): DetailsItemGroup {
  return DETAILS_ITEM_GROUPS.find((g) => g.keys.includes(key))!.group;
}

export function detailsItemHref(eventId: string, item: DetailsItemKey, extra = ''): string {
  return `/dashboard/${eventId}/launch?tool=details&item=${item}${extra}`;
}
