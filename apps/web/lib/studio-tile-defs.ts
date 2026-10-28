/**
 * lib/studio-tile-defs.ts — THE STUDIO TILES' KEYS and the editor each opens, on their own
 * so the Maker's shell can map a tile to its editor (`studioTileItem`) WITHOUT pulling the tiles' words or
 * their status derivation (`lib/studio-tiles.ts` → the guided flow, the setup steps) into its first load
 * (`scripts/check-maker-js-budget.mjs`). `lib/studio-tiles.ts` re-exports all of it — one truth.
 */
import { EVERY_PRINT_ITEM, LOOK_SECTION_ITEM_KEYS, type DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 🗂 R1 (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE GUESTS ⚙"):
 * the RSVP tile LEFT — its settings live in Guests ⚙ (`lib/event-settings-record.ts` `MAKER_RSVP_MOVED_TO_GUESTS`);
 * only the Reply page stays, inside the Invitation stage. Every old door forwards there (`lib/r1-rsvp-forwards.test.ts`).
 */
/**
 * 🗂 R4 (owner 2026-10-27/28, same row; *"On guests we have things to move there: March, Seat, Rsvp"*): the Wedding March
 * and Seat plan tiles LEFT — they are Guests › March and Guests › Seats (`lib/guests-views.ts`), the same makers drawn
 * whole there; every old door forwards (`lib/r4-seats-march-forwards.test.ts`).
 */
export const STUDIO_TILE_KEYS = ['info', 'look', 'logo', 'mood', 'schedule', 'story', 'gifts', 'prints'] as const;
export type StudioTileKey = (typeof STUDIO_TILE_KEYS)[number];

/**
 * The shipped Event Details item each tile opens — ALL the Maker's shell needs of a tile. The tiles' WORDS
 * (label · short · sub · what "done" reads) are `STUDIO_TILES` in `lib/studio-tiles.ts`, which only the
 * server reads: kept there so this module — in the Maker's FIRST LOAD through `maker-shell.tsx` — carries
 * eleven keys and not eleven tiles of copy (507 KB, never raised).
 */
export const STUDIO_TILE_ITEM: Readonly<Record<StudioTileKey, DetailsItemKey>> = {
  info: 'names',
  look: 'background',
  logo: 'logo',
  mood: 'mood-board',
  schedule: 'schedule',
  story: 'love-story',
  gifts: 'gifts',
  /* 🖨 Prints opens at the head of its form — "On every print", then the Invitation (owner 2026-10-16). */
  prints: EVERY_PRINT_ITEM,
};

/**
 * 🧭 THE EDITOR A TILE OPENS — each tile its OWN (owner 2026-10-07: Look opened the Logo editor). Look keeps
 * the Look section the couple was on (Background · Elements · Music) and otherwise opens on
 * Background — never another Look-group item (Logo, Mood Board, Cover page, Reveal), which the lower
 * third's "stay where you were" used to carry over. Every other tile opens its own item.
 */
export function studioTileItem(key: StudioTileKey, current: string | null): DetailsItemKey {
  if (key === 'look') {
    return current !== null && (LOOK_SECTION_ITEM_KEYS as readonly string[]).includes(current) ? (current as DetailsItemKey) : 'background';
  }
  return STUDIO_TILE_ITEM[key];
}
