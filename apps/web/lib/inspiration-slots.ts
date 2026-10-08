/**
 * lib/inspiration-slots.ts — STUDIO › MOOD BOARD › INSPIRATION, ONE CARD PER PART
 * (owner 2026-10-06, DECISION_LOG "MOOD BOARD › INSPIRATION: UPLOAD BY SLOT",
 * "EVERY MOOD BOARD PART HAS ITS OWN INSPIRATION AND ITS OWN PALETTE",
 * "MOOD BOARD PARTS ADDED: CEILING · BRIDAL BOUQUET · WALL · TUNNEL · STAGE ·
 * CENTREPIECES").
 *
 * 🔑 NOTHING HERE IS A NEW SLOT. Every card the couple can upload into is an
 * EXISTING `event_inspiration_assets.slot_key` (`MOODBOARD_SLOT_KEYS`, held by
 * the DB CHECK `event_inspiration_assets_slot_key_check`), named the way the
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
 * four boards the owner asked for by name. `AWAITING_A_SLOT` stays as the place
 * a future part with no slot is recorded (empty today). `every-slot-maps-to-a-
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
 * `groomsmen` · `flower_girl` · `ring_bearer` · `entourage`.
 *
 * Pure, client-safe: types only from the taxonomy (it reaches the server).
 */
import type { MoodboardSlotKey } from './moodboard-slots';
import type { WeddingTile } from './taxonomy';

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
     their own since migration 20271266380994. `entourage` STAYS, last — the whole party's board, and
     couples' photos already live on it.
     🧒 Flower girl · Ring bearer: no palette button. The two share ONE palette (`bearers_flower_girl`),
     so "use this board's colours" from either would overwrite the other's — shown, never applied. */
  { slotKey: 'bride', label: 'Bridal gown', from: 'gown designers and make-up artists', target: { kind: 'role', key: 'bride' }, useLabel: 'Use for the bride’s colours', attire: true },
  { slotKey: 'groom', label: 'Groom’s suit', from: 'suit and barong makers', target: { kind: 'none' }, useLabel: null, attire: true },
  { slotKey: 'bridesmaids', label: 'Bridesmaids', from: 'dress and Filipiniana makers', target: { kind: 'role', key: 'bridesmaids' }, useLabel: 'Use for the bridesmaids', attire: true },
  { slotKey: 'groomsmen', label: 'Groomsmen', from: 'suit and barong makers', target: { kind: 'role', key: 'groomsmen' }, useLabel: 'Use for the groomsmen', attire: true },
  { slotKey: 'flower_girl', label: 'Flower girl', from: 'dress and Filipiniana makers', target: { kind: 'none' }, useLabel: null, attire: true, beside: 'bearers_flower_girl' },
  { slotKey: 'ring_bearer', label: 'Ring bearer', from: 'suit and barong makers', target: { kind: 'none' }, useLabel: null, attire: true, beside: 'bearers_flower_girl' },
  { slotKey: 'entourage', label: 'Entourage', from: 'attire makers', target: { kind: 'role', key: 'wedding_party' }, useLabel: 'Use for the entourage', attire: true },
  { slotKey: 'cake', label: 'Cake', from: 'cake and dessert makers', target: { kind: 'none' }, useLabel: null },
  /* 💐 Their slots exist since 2026-10-07 (migration 20271265788160, step 4c). */
  { slotKey: 'bridal_bouquet', label: 'Bridal bouquet', from: 'florists', target: { kind: 'florals' }, useLabel: 'Use for the florist’s colours' },
  { slotKey: 'centrepieces', label: 'Centrepieces', from: 'florists, stylists and caterers', target: { kind: 'room' }, useLabel: 'Use for the room' },
];

/**
 * The owner's parts that have no `slot_key` to store a photo in. Each maps to
 * EXISTING taxonomy tiles (the 2026-09-03 rule — nothing invented); what is
 * missing is storage, i.e. a migration widening the slot CHECK.
 */
export const AWAITING_A_SLOT: ReadonlyArray<{ label: string; trades: readonly WeddingTile[] }> = [
  /* Empty since 2026-10-08: the owner's four attire boards (Groomsmen · Bridesmaids · Flower girl ·
     Ring bearer) waited here until he said "go" on the migration that gave each a slot. */
];

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
