/**
 * lib/inspiration-slots.ts — STUDIO › MOOD BOARD › INSPIRATION, ONE CARD PER PART
 * (owner 2026-10-06, DECISION_LOG "MOOD BOARD › INSPIRATION: UPLOAD BY SLOT",
 * "EVERY MOOD BOARD PART HAS ITS OWN INSPIRATION AND ITS OWN PALETTE",
 * "MOOD BOARD PARTS ADDED: CEILING · BRIDAL BOUQUET · WALL · TUNNEL · STAGE ·
 * CENTREPIECES").
 *
 * 🔑 NOTHING HERE IS A NEW SLOT. Every card the couple can upload into is an
 * EXISTING `event_inspiration_assets.slot_key` (since step ② of PLAN
 * `admin_inspiration_groups_2026-10-25`: a row of `inspiration_parts`, held by an FK), named the way the
 * prototype names it — "Wall" is the shipped `backdrop` slot (its board label is
 * already "Wall design"), "Venue & decor" is `overall`. A card's suppliers are
 * the slot's OWN trades (`MOODBOARD_SLOT_TRADES`, the 2026-09-03 "inspiration by
 * slot" ruling) — never a second list.
 *
 * 💐 BRIDAL BOUQUET AND CENTREPIECES HAVE THEIR SLOTS (2026-10-07, step 4c):
 * migration 20271265788160 widened both DB gates, and `MOODBOARD_SLOT_KEYS`,
 * the trades and the shipped board's tiles carry them — so they are drawn
 * here like every other card.
 *
 * 👗 SO DO THE FOUR ATTIRE BOARDS (2026-10-08, owner: *"go"*): Bridesmaids ·
 * Groomsmen · Flower girl · Ring bearer, migration 20271266380994. They are the
 * one place this file's first sentence stops being true — four slots made for
 * four boards the owner asked for by name. (`AWAITING_A_SLOT`, the empty list a future part without a slot
 * waited in, is gone with step ②: a new part is now one `inspiration_parts` row.) `every-slot-maps-to-a-
 * taxonomy-category.test.ts`, `bouquet-and-centrepieces-have-a-slot.test.ts`
 * and `four-more-attire-boards.test.ts` hold it.
 *
 * 📐 WHAT A BOARD STORES (read by the dress-code scene's "Photos" later — keep
 * it stable): up to three rows in `event_inspiration_assets`, one per
 * `(event_id, slot_key, slot_position 1–3)` among rows with `removed_at IS
 * NULL`; each carries `image_url`, its six `sampled_hex_1…6`, `source_kind`
 * (`file_upload` for the couple's own photo, `gallery_pick` for a supplier's,
 * with `library_asset_id` naming it) — nothing else, and nothing per board. The
 * attire boards' `slot_key`s are `bride` · `groom` · `bridesmaids` ·
 * `groomsmen` · `flower_girl` · `ring_bearer` (`entourage` left Attire 2026-10-14).
 *
 * Pure, client-safe: types only from the taxonomy (it reaches the server).
 */
import type { MoodboardSlotKey } from './moodboard-slots';
import type { RoomDressing } from './mood-board';
import type { WeddingTile } from './taxonomy';
/* Pure and client-safe too (its only value import is `./mood-board`), so this file stays reachable from the client. */
import { CAKE_LANE_PARTS, FLORIST_LANE_PARTS, ROOM_LANE_PARTS, type LanePart } from './colour-access';
/* Pure and client-safe as well (values only from `./moodboard-slots`). */
import { fallbackInspirationParts, inspirationPart, type InspirationPartsSnapshot } from './inspiration-parts';

/** Which lane a slot's palette paints when the couple taps "Use for …". */
export type SlotPaletteTarget =
  /** The florist's colours — the room's floral statement (`room_dressing.florals`). */
  | { kind: 'florals' }
  /** The room — table linens, chairs and the light's warmth (`room_dressing`). */
  | { kind: 'room' }
  /** A role's own colours (`role_palette[key]`), touched so the main colours never move them. */
  | { kind: 'role'; key: 'bride' | 'wedding_party' | 'bridesmaids' | 'groomsmen' }
  /** No colour of its own to set yet (a stage, a ceiling, a cake) — the palette is shown, not applied. */
  | { kind: 'none' };

export type StudioInspirationSlot = {
  /** The stored slot. */
  slotKey: MoodboardSlotKey;
  /** The prototype's name for it. */
  label: string;
  /** Who its ideas come from, in the prototype's words ("florists and stylists"). */
  from: string;
  /** What its palette paints, and how the button says it. */
  target: SlotPaletteTarget;
  useLabel: string | null;
  /** 👗 An attire board — drawn INSIDE Mood Board › Attire, next to its role, not in Inspiration (owner 2026-10-08). */
  attire?: true;
  /**
   * The Attire row this board sits under, when that row's key is not the slot's
   * own: the guest list's bearers are ONE row (`bearers_flower_girl`) and hold
   * two boards. Absent = the row whose key is `slotKey` (`bride`, `groom`,
   * `bridesmaids`, `groomsmen`).
   */
  beside?: string;
};

/** The Attire row an attire board sits under. */
export function attireRowOf(slot: StudioInspirationSlot): string {
  return slot.beside ?? slot.slotKey;
}

/**
 * 👗 WHERE EACH ATTIRE BOARD IS DRAWN in Mood Board › Attire — every board exactly once, whatever the
 * guest list holds: under its role's row when that row is on the list (`attireBoardsUnder`), else after
 * the rows, in the owner's order (`attireBoardsAfter`). A board is never lost because nobody holds its
 * role yet — the couple collects ideas before they name their bridesmaids.
 */
export function attireBoardsUnder(rowKey: string): StudioInspirationSlot[] {
  return STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire && attireRowOf(s) === rowKey);
}
export function attireBoardsAfter(rowKeys: readonly string[]): StudioInspirationSlot[] {
  return STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire && !rowKeys.includes(attireRowOf(s)));
}

/**
 * The cards, in the prototype's order.
 */
export const STUDIO_INSPIRATION_SLOTS: readonly StudioInspirationSlot[] = [
  { slotKey: 'flowers', label: 'Flowers', from: 'florists and stylists', target: { kind: 'florals' }, useLabel: 'Use for the florist’s colours' },
  { slotKey: 'table', label: 'Tables', from: 'stylists and florists', target: { kind: 'room' }, useLabel: 'Use for the room' },
  { slotKey: 'stage', label: 'Stage', from: 'stylists, lights and sound', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'ceiling', label: 'Ceiling', from: 'stylists and lights', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'backdrop', label: 'Wall', from: 'stylists and LED walls', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'tunnel', label: 'Tunnel', from: 'stylists', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'overall', label: 'Venue & decor', from: 'venues, stylists and lights', target: { kind: 'room' }, useLabel: 'Use for the room' },
  /* 👗 ATTIRE (owner 2026-10-08, *"Inspiration can go more. Bridal Gown, Groom's Suit, Groomsmen,
     Bridesmaid, Flowergirl, Ring Bearer"* — *"on attire, they can upload inspiration photos and also
     search from the photos uploaded by vendors"*): one board each, in his order, each uploading and
     searching its own shelf of suppliers' photos through the shipped picker. The bride's card is the
     gown; the groom's slot (stored since onboarding) is the suit; the four after them have slots of
     their own since migration 20271266380994.
     🗑 ENTOURAGE IS GONE FROM ATTIRE (owner 2026-10-14: *"remove entourage"*): Bridesmaids · Groomsmen · Flower
     girl · Ring bearer carry their own boards. Its stored photos stay in their rows (nothing is deleted) and its
     slot stays in the DB vocabulary; the `wedding_party` palette stays the silent fallback the party's colours
     resolve through (`resolveAttirePaletteColors`).
     🧒 Flower girl · Ring bearer: no palette button. The two share ONE palette (`bearers_flower_girl`),
     so "use this board's colours" from either would overwrite the other's — shown, never applied. */
  { slotKey: 'bride', label: 'Bridal gown', from: 'gown designers and make-up artists', target: { kind: 'role', key: 'bride' }, useLabel: 'Use for the bride’s colours', attire: true },
  { slotKey: 'groom', label: 'Groom’s suit', from: 'suit and barong makers', target: { kind: 'none' }, useLabel: null, attire: true },
  { slotKey: 'bridesmaids', label: 'Bridesmaids', from: 'dress and Filipiniana makers', target: { kind: 'role', key: 'bridesmaids' }, useLabel: 'Use for the bridesmaids', attire: true },
  { slotKey: 'groomsmen', label: 'Groomsmen', from: 'suit and barong makers', target: { kind: 'role', key: 'groomsmen' }, useLabel: 'Use for the groomsmen', attire: true },
  { slotKey: 'flower_girl', label: 'Flower girl', from: 'dress and Filipiniana makers', target: { kind: 'none' }, useLabel: null, attire: true, beside: 'bearers_flower_girl' },
  { slotKey: 'ring_bearer', label: 'Ring bearer', from: 'suit and barong makers', target: { kind: 'none' }, useLabel: null, attire: true, beside: 'bearers_flower_girl' },
  { slotKey: 'cake', label: 'Cake', from: 'cake and dessert makers', target: { kind: 'none' }, useLabel: null },
  /* 💐 Their slots exist since 2026-10-07 (migration 20271265788160, step 4c). */
  { slotKey: 'bridal_bouquet', label: 'Bridal bouquet', from: 'florists', target: { kind: 'florals' }, useLabel: 'Use for the florist’s colours' },
  { slotKey: 'centrepieces', label: 'Centrepieces', from: 'florists, stylists and caterers', target: { kind: 'room' }, useLabel: 'Use for the room' },
  /* 🎨🖼 The Palette's five parts with photos of their own (owner 2026-10-19, "2. yes"; migration 20271278232574). Each
     sits on its part's block, whose own offer ("Use for Chairs") sets that part — so none carries a slot target. */
  { slotKey: 'chairs', label: 'Chairs', from: 'stylists and chair rentals', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'ribbons_candles', label: 'Ribbons & candles', from: 'stylists', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'lights', label: 'Lights', from: 'lights and sound, and stylists', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'entourage_bouquets', label: 'Entourage bouquets', from: 'florists', target: { kind: 'none' }, useLabel: null },
  { slotKey: 'flower_accents', label: 'Flower accents', from: 'florists and stylists', target: { kind: 'none' }, useLabel: null },
];

/**
 * 🎨🖼 THE PALETTE'S PARTS HOLD THEIR OWN PHOTOS (owner 2026-10-19, DECISION_LOG "APPROVED — PALETTE + INSPIRATION AS
 * ONE LIST", prototype `palette_inspiration_one_list_2026-10-19.html`): Studio › Mood Board's Palette and Inspiration
 * are one list, and each part's block carries its board's photos line (`paletteBoardOf`, by the part's `field`).
 * NOTHING MOVES IN THE DATABASE: a board keeps its `slot_key`, so every stored photo is drawn where its board now
 * sits, and every write still names that key.
 *
 *   · Venue & decor (`overall`) feeds YOUR MAIN PALETTE — its photos sit under the five (`MAIN_PALETTE_BOARD`).
 *   · Flowers (`flowers`, every flower at once) has no part of its own: the finer boards (Bridal bouquet ·
 *     Centrepieces · Entourage bouquets · Accents) sit on their parts. Its photos, where an event holds any, keep a
 *     block of their own in the florist's group (`LEGACY_PALETTE_BOARDS`) — never offered for a new photo.
 *
 * `the-palette-holds-the-boards.test.ts` holds that every non-attire board in the Studio is drawn exactly once.
 */
const PART_BOARD: Readonly<Partial<Record<keyof RoomDressing, MoodboardSlotKey>>> = {
  stage: 'stage',
  ceiling: 'ceiling',
  /* "Wall" is the shipped `backdrop` slot (above). */
  walls: 'backdrop',
  tunnel: 'tunnel',
  linens: 'table',
  chairs: 'chairs',
  ribbons_candles: 'ribbons_candles',
  lighting_warmth: 'lights',
  bridal_bouquet: 'bridal_bouquet',
  entourage_bouquets: 'entourage_bouquets',
  florals: 'centrepieces',
  flower_accents: 'flower_accents',
  cake: 'cake',
};
const slotOf = (k: MoodboardSlotKey) => STUDIO_INSPIRATION_SLOTS.find((s) => s.slotKey === k) ?? null;
export function paletteBoardOf(field: keyof RoomDressing | undefined): StudioInspirationSlot | null {
  const k = field ? PART_BOARD[field] : undefined;
  return k ? slotOf(k) : null;
}
export const MAIN_PALETTE_BOARD: MoodboardSlotKey = 'overall';
export const LEGACY_PALETTE_BOARDS: readonly MoodboardSlotKey[] = ['flowers'];
/** The boards a couple's own photo may go to from the Palette's "Which part?" — every part's, and Venue & decor's. */
export function paletteUploadBoards(): StudioInspirationSlot[] {
  const keys = new Set<MoodboardSlotKey>([MAIN_PALETTE_BOARD, ...(Object.values(PART_BOARD) as MoodboardSlotKey[])]);
  return STUDIO_INSPIRATION_SLOTS.filter((s) => !s.attire && keys.has(s.slotKey));
}

/* ══ ONE LIST OF THE PARTS THAT HOLD PHOTOS — the couple's "Which part?" AND the supplier's library ══════════════
 *
 * 🌱🖼 Owner 2026-10-19 (DECISION_LOG "SUPPLIERS FILL THE INSPIRATION LIBRARY WITHOUT AN EVENT"): a supplier adds
 * photos to the SAME parts, by the SAME names, in the SAME order the couple's Palette draws them — *"keep the mapping
 * consistent and don't let me trace it"*. So both pickers read this one function: the couple's Studio upload bar
 * (`mood-board-studio.tsx`, the Palette's parts) and the supplier's `/vendor-dashboard/moodboard-library`
 * (`uploadableSlotsForShop`, the Palette's parts then the Attire boards). A new Palette part with a board joins both
 * lists at once; `every-palette-part-reaches-the-supplier-library.test.ts` fails when it has no supplying trade.
 */
/**
 * The heading a part is drawn under. `more` = a part no couple's Studio card draws (the older shelves —
 * Ceremony venue, Cocktail hour, the sponsors' attire …), which only the supplier's `Part ▾` lists.
 * ⚠ The headings are still these words until step ④, which heads each run by the part's HOME CATEGORY
 * (PLAN § 7: "the parts' grouping words change from 'The room' to the category's name (④)").
 */
export type PhotoPartGroup = 'main' | 'room' | 'flowers' | 'cake' | 'attire' | 'more';
export type PhotoPart = { key: MoodboardSlotKey; label: string; group: PhotoPartGroup };

/** The supplier's dropdown headings (the couple's say "for your stylist"; a supplier IS the stylist). */
export const PHOTO_PART_GROUP_LABEL: Readonly<Record<PhotoPartGroup, string>> = {
  main: 'Main palette',
  room: 'The room',
  flowers: 'Flowers',
  cake: 'Cake',
  attire: 'Attire',
  more: 'More boards',
};

/**
 * 🧩 WHICH board sits in which heading is the Studio's own structure (the main palette, the colour lanes,
 * the attire rows); WHAT each part is called, WHETHER it is offered and in WHAT order inside its heading
 * are the parts snapshot's (`getInspirationParts()`, step ②). A part the snapshot does not hold is not
 * drawn; a HIDDEN part is not offered to the couple (`includeHidden: false`) but stays on the supplier's
 * shelves (`includeHidden: true` — "hidden from couples" is the switch's whole meaning).
 */
function studioPhotoParts(parts: InspirationPartsSnapshot, includeHidden: boolean, attire: boolean): PhotoPart[] {
  const place: Array<{ key: MoodboardSlotKey; group: PhotoPartGroup }> = [];
  const add = (key: MoodboardSlotKey, group: PhotoPartGroup) => {
    if (!place.some((p) => p.key === key)) place.push({ key, group });
  };
  add(MAIN_PALETTE_BOARD, 'main');
  const lane = (lp: readonly LanePart[], group: PhotoPartGroup) => {
    for (const p of lp) {
      const b = paletteBoardOf(p.field);
      if (b) add(b.slotKey, group);
    }
  };
  lane(ROOM_LANE_PARTS, 'room');
  lane(FLORIST_LANE_PARTS, 'flowers');
  lane(CAKE_LANE_PARTS, 'cake');
  if (attire) for (const s of STUDIO_INSPIRATION_SLOTS) if (s.attire) add(s.slotKey, 'attire');

  const out: Array<PhotoPart & { order: number }> = [];
  for (const { key, group } of place) {
    const part = inspirationPart(parts, key);
    if (!part || (part.hidden && !includeHidden)) continue;
    out.push({ key, label: part.label, group, order: part.sortOrder });
  }
  const groupAt = (g: PhotoPartGroup) => place.findIndex((p) => p.group === g);
  return out
    .sort((a, b) => groupAt(a.group) - groupAt(b.group) || a.order - b.order)
    .map(({ key, label, group }) => ({ key, label, group }));
}

/** The couple's "Which part?": Venue & decor, then every Palette part with a board — named, ordered and offered by the snapshot. */
export function palettePhotoParts(parts: InspirationPartsSnapshot = fallbackInspirationParts()): PhotoPart[] {
  return studioPhotoParts(parts, false, false);
}

/** The Palette's parts, then the Attire boards (Bridal gown · Groom’s suit · Bridesmaids · …) — the supplier's order. */
export function libraryPhotoParts(parts: InspirationPartsSnapshot = fallbackInspirationParts()): PhotoPart[] {
  return studioPhotoParts(parts, true, true);
}

/* ══ SEARCH IDEAS › — the shipped gallery picker's filters ══════════════════ */

/**
 * From ▾ (owner 2026-10-06, "EACH MOOD BOARD PART CAN SEARCH SUPPLIERS' PHOTOS").
 * Each is a set of EXISTING taxonomy tiles; the server turns tiles into the
 * shop's canonical services. "Setnayan" is not here: the supplier gallery holds
 * only photos credited to a shop (`shapeGalleryPage` withholds the rest), so it
 * would always be empty.
 */
export const GALLERY_FROM = [
  { key: 'everyone', label: 'Everyone', tiles: [] },
  { key: 'florists', label: 'Florists', tiles: ['florist'] },
  { key: 'stylists', label: 'Stylists', tiles: ['stylist_decorator'] },
  { key: 'tables', label: 'Tables', tiles: ['catering'] },
  { key: 'venues', label: 'Venues', tiles: ['reception', 'ceremony_venue'] },
] as const satisfies ReadonlyArray<{ key: string; label: string; tiles: readonly WeddingTile[] }>;

export type GalleryFromKey = (typeof GALLERY_FROM)[number]['key'];

export function isGalleryFromKey(v: unknown): v is GalleryFromKey {
  return typeof v === 'string' && GALLERY_FROM.some((f) => f.key === v);
}

/** The words a search may carry — letters, digits, spaces and a few joiners; nothing a filter could read as syntax. */
export const GALLERY_SEARCH_MAX = 40;
export function cleanGallerySearch(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} '&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GALLERY_SEARCH_MAX);
  return q.length >= 2 ? q : null;
}

/** "Bloom & Vine · Florist" → "Florist"; a couple's own photo → "Yours"; a credit with no trade → null. */
export function photoTag(credit: string | null | undefined): string | null {
  if (!credit) return 'Yours';
  const i = credit.lastIndexOf(' · ');
  /* "Stylist / Decorator" → "Stylist": a tag on a photo is one short word. */
  return i >= 0 ? (credit.slice(i + 3).split(' / ')[0] ?? null) : null;
}
