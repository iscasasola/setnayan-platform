/**
 * lib/studio-tile-defs.ts — THE ELEVEN STUDIO TILES' DEFINITIONS and the editor each opens, on their own
 * so the Maker's shell can map a tile to its editor (`studioTileItem`) WITHOUT pulling the tiles' status
 * derivation (`lib/studio-tiles.ts` → the guided flow, the setup steps) into its first load
 * (`scripts/check-maker-js-budget.mjs`). `lib/studio-tiles.ts` re-exports all of it — one truth.
 */
import { DETAILS_FIRST_PRINT, LOOK_SECTION_ITEM_KEYS, type DetailsItemKey } from '@/lib/maker-details-items';

export const STUDIO_TILE_KEYS = ['info', 'look', 'logo', 'mood', 'schedule', 'story', 'march', 'seats', 'gifts', 'rsvp', 'prints'] as const;
export type StudioTileKey = (typeof STUDIO_TILE_KEYS)[number];

type StudioTileDef = {
  /** The tile's name, and the short name the pill shows. */
  label: string;
  short: string;
  /** The shipped Event Details item the tile opens. */
  item: DetailsItemKey;
  /** The items whose `done` this tile reads (all must be read, and all true). */
  reads: readonly DetailsItemKey[];
  /** Wedding March and Seat plan: the top nav hides, ✓ Done returns (owner: "yes for those 2"). */
  immersive?: true;
  /** What it holds, in the prototype's words — the status line where no count says more. */
  sub: string;
};

export const STUDIO_TILES: Readonly<Record<StudioTileKey, StudioTileDef>> = {
  info: { label: 'Info', short: 'Info', item: 'names', reads: ['names', 'date', 'venues'], sub: 'Your event · Your Event Hub' },
  look: { label: 'Look', short: 'Look', item: 'background', reads: ['theme'], sub: 'Background · Colours · Font · Music' },
  logo: { label: 'Logo', short: 'Logo', item: 'logo', reads: ['logo'], sub: 'Mark · fonts · animation' },
  mood: { label: 'Mood Board & Dress Code', short: 'Mood Board', item: 'mood-board', reads: ['mood-board'], sub: 'Five colours · attire by role' },
  schedule: { label: 'Schedule', short: 'Schedule', item: 'schedule', reads: ['schedule'], sub: 'Times and moments' },
  story: { label: 'Love Story', short: 'Love Story', item: 'love-story', reads: ['love-story'], sub: 'Chapters with a photo' },
  march: { label: 'Wedding March', short: 'March', item: 'march', reads: ['march'], immersive: true, sub: 'Drag the names, two columns' },
  seats: { label: 'Seat plan', short: 'Seat plan', item: 'seating', reads: ['seating'], immersive: true, sub: 'Tables and who sits where' },
  gifts: { label: 'E-Gifts', short: 'E-Gifts', item: 'gifts', reads: [], sub: 'GCash · Maya · bank · PayPal' },
  rsvp: { label: 'RSVP', short: 'RSVP', item: 'rsvp', reads: [], sub: 'Reply by · what the form asks' },
  prints: { label: 'Prints', short: 'Prints', item: DETAILS_FIRST_PRINT, reads: [], sub: 'Invitation set · for the day' },
};

/**
 * 🧭 THE EDITOR A TILE OPENS — each tile its OWN (owner 2026-10-07: Look opened the Logo editor). Look keeps
 * the Look section the couple was on (Background · Colours · Font · Music) and otherwise opens on
 * Background — never another Look-group item (Logo, Mood Board, Cover page, Reveal), which the lower
 * third's "stay where you were" used to carry over. Every other tile opens its own item.
 */
export function studioTileItem(key: StudioTileKey, current: string | null): DetailsItemKey {
  if (key === 'look') {
    return current !== null && (LOOK_SECTION_ITEM_KEYS as readonly string[]).includes(current) ? (current as DetailsItemKey) : 'background';
  }
  return STUDIO_TILES[key].item;
}
