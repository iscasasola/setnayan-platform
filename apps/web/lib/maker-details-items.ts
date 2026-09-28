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
 * 🎨 THE LOOK — Mood Board · Logo · Hero · Reveal (Details part 3, owner
 * 2026-09-28/29: "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS" and
 * "SCHEDULE, MOOD BOARD AND SEAT PLAN MOVE INSIDE…"). Each is a SHIPPED page
 * moved in whole — the Mood Board studio, the Logo studio, the Hero and the
 * Reveal pages — never redrawn.
 */
export type LookItemKey = 'mood-board' | 'logo' | 'hero' | 'reveal';
export type FreePrintKey = FreePrint['key'];
/** The whole invitation set in one download — every piece, every guest's pass. */
export type DownloadItemKey = 'download';
export type DetailsItemKey = 'theme' | LookItemKey | HubItemKey | PrintSetKey | FreePrintKey | DownloadItemKey;

export const HUB_ITEM_KEYS: readonly HubItemKey[] = ['address', 'qr'];
/** The Look after Theme, in the owner's order: Theme · Mood Board · Logo · Hero · Reveal. */
export const LOOK_ITEM_KEYS: readonly LookItemKey[] = ['mood-board', 'logo', 'hero', 'reveal'];
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
 *   Look (Theme · Mood Board · Logo · Hero · Reveal) · Your event · Words · Story & plans
 *   (Love Story · Schedule · RSVP) · Your Event Hub (Address · QR) ·
 *   Invitation set · For the day · Download the set
 *
 * DATA, not markup. Part 1 filled Theme, Your Event Hub, the Invitation set,
 * For the day and Download; part 3 adds the Look (Mood Board · Logo · Hero ·
 * Reveal); part 2 adds its items to its rows (and their bodies and editors) —
 * nothing else moves. A group with no items yet is simply not drawn.
 */
export type DetailsItemGroup = 'look' | 'event' | 'words' | 'story' | 'hub' | 'set' | 'day' | 'download';
export const DETAILS_ITEM_GROUPS: ReadonlyArray<{ group: DetailsItemGroup; label: string; keys: readonly DetailsItemKey[] }> = [
  { group: 'look', label: 'Look', keys: ['theme', ...LOOK_ITEM_KEYS] },
  { group: 'event', label: 'Your event', keys: [] },
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
 * 🧭 THE PAGES THAT MOVED INTO DETAILS (owner 2026-09-28, DECISION_LOG "OPTION B
 * — EVERYTHING MADE ONCE LIVES IN DETAILS; THE TOP MENU IS THE FOUR STAGES +
 * DETAILS"): Logo, Hero, Reveal, Love Story and RSVP left the Maker's place
 * menu; each is an item of Details, and an old `?tool=<page>` (a bookmark, a
 * save's return address, a door elsewhere in the app) lands on that item.
 *
 * A page moves ONLY once its Details item exists (`isDetailsItemKey`): Logo,
 * Hero and Reveal are items since part 3; Love Story and RSVP are part 2's
 * (`love-story`, `rsvp`) — until their items land, their old address keeps
 * opening their own page, so no door leads nowhere.
 */
const MOVED_PAGE_ITEM: Readonly<Record<string, string>> = {
  logo: 'logo',
  hero: 'hero',
  reveal: 'reveal',
  'love-story': 'love-story',
  'rsvp-page': 'rsvp',
};

/** The Details item a moved page's `?tool=` (or a Maker selection's key) now opens, or null. */
export function movedPageItem(tool: string | null | undefined): DetailsItemKey | null {
  if (!tool) return null;
  const item = MOVED_PAGE_ITEM[tool];
  return isDetailsItemKey(item) ? item : null;
}

/**
 * Which Maker page an old `?tool=` means now — Prints & Tickets is Details, and
 * so is every page that moved in (`movedPageItem`). Anything else is returned
 * as it came.
 */
export function makerToolFor(tool: string | null | undefined): string | null {
  if (!tool) return null;
  return tool === 'prints' || movedPageItem(tool) ? 'details' : tool;
}

/**
 * The item a Details address opens. `tool` is the RAW `?tool=` (before
 * `makerToolFor`), so an old Prints & Tickets link — or an old Logo, Hero or
 * Reveal link — is told apart.
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
  const moved = movedPageItem(search.tool);
  if (moved) return moved;
  return search.tool === 'prints' ? DETAILS_FIRST_PRINT : DETAILS_FIRST_ITEM;
}

/**
 * HOW AN ITEM'S PAGE SITS IN THE BODY. Default ('flow'): a picture in the
 * scrolling column, its editor on the right. The pages that moved in keep the
 * split they shipped with:
 *   · 'fill'  — a live page (the Hero, the Reveal) fills the body; its
 *               controls are the editor on the right, as on their old page;
 *   · 'whole' — the page carries its own tools: the Logo studio lays its panel
 *               beside its canvas, and the Mood Board is one board — so no
 *               second editor column is drawn beside them.
 */
export type DetailsItemLayout = 'flow' | 'fill' | 'whole';
const ITEM_LAYOUT: Partial<Record<DetailsItemKey, DetailsItemLayout>> = {
  hero: 'fill',
  reveal: 'fill',
  logo: 'whole',
  'mood-board': 'whole',
};
export function detailsItemLayout(key: DetailsItemKey): DetailsItemLayout {
  return ITEM_LAYOUT[key] ?? 'flow';
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

/**
 * Is the Maker's work area — and so Details — this viewer's? The couple's, on
 * an event whose type has an Event Hub (`surfaceEnabled(profile, 'website')`).
 * ONE rule, read by the launch page (`hasWork`) and by every old page that now
 * lands on a Details item for the couple (the Mood Board): a coordinator, or an
 * event type with no Event Hub, keeps the old page, so no one is sent to a
 * Maker that has nothing for them.
 */
export function makerHasWork(memberType: string | null | undefined, websiteOn: boolean): boolean {
  return memberType === 'couple' && websiteOn;
}
