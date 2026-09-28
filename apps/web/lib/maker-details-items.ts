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
import type { EventTypeProfile } from '@/lib/event-type-profile';
import { resolveRoleSet } from '@/lib/role-sets';

export type HubItemKey = 'address' | 'qr';
export type FreePrintKey = FreePrint['key'];
/** The whole invitation set in one download — every piece, every guest's pass. */
export type DownloadItemKey = 'download';
export type DetailsItemKey = 'theme' | HubItemKey | PrintSetKey | FreePrintKey | DownloadItemKey;

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

/**
 * 🎂 THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED ON (owner
 * 2026-09-29, DECISION_LOG row of that name). Which items and switches a
 * celebration gets is decided HERE, from the shipped event-type data (the
 * type's `EventTypeProfile` and the role set it names) — never by a
 * "wedding" test sprinkled through the page. The words are the type's own
 * (`EventWords`); no item of part 1 types "wedding" or "couple".
 */
export type DetailsItemContext = {
  profile: EventTypeProfile;
  /** The event's words (`eventWordsFromProfile`) — for the solemn register. */
  solemn: boolean;
};

/**
 * An item that does not suit every celebration names its rule here; an item
 * with no rule applies to all. Part 1's items — the theme, the address, the QR,
 * every print — suit every type (the prints already follow the type's words).
 * Parts 2–5 add rules for theirs (e.g. Love Story).
 */
export const DETAILS_ITEM_APPLIES: Partial<Record<DetailsItemKey, (c: DetailsItemContext) => boolean>> = {};

export function detailsItemApplies(key: DetailsItemKey, ctx: DetailsItemContext): boolean {
  return DETAILS_ITEM_APPLIES[key]?.(ctx) ?? true;
}

/** The navigator's rows for this celebration — the groups in order, each with the items that apply. */
export function detailsNavigatorKeys(
  ctx: DetailsItemContext,
  present: ReadonlySet<DetailsItemKey>,
): Array<{ group: DetailsItemGroup; label: string; keys: DetailsItemKey[] }> {
  return DETAILS_ITEM_GROUPS.map((g) => ({
    group: g.group,
    label: g.label,
    keys: g.keys.filter((k) => present.has(k) && detailsItemApplies(k, ctx)),
  })).filter((g) => g.keys.length > 0);
}

/**
 * The switches that depend on the type. "Parents on the invitation" exists
 * only where the type's role set offers a parent role (a wedding's Parents of
 * the Bride / of the Groom) — a birthday or a wake has no such role, so it has
 * no such switch, and no "Parent of the Bride" dropdown.
 */
export function detailsSwitchesFor(ctx: DetailsItemContext): { parents: boolean } {
  const offered = resolveRoleSet(ctx.profile.roleSetKey).offeredRoles as readonly string[];
  return { parents: offered.includes('bride_parents') || offered.includes('groom_parents') };
}

export function groupOfItem(key: DetailsItemKey): DetailsItemGroup {
  return DETAILS_ITEM_GROUPS.find((g) => g.keys.includes(key))!.group;
}

export function detailsItemHref(eventId: string, item: DetailsItemKey, extra = ''): string {
  return `/dashboard/${eventId}/launch?tool=details&item=${item}${extra}`;
}
