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
 * here like every other card. `AWAITING_A_SLOT` stays as the place a future
 * part with no slot is recorded (empty today). `every-slot-maps-to-a-taxonomy-
 * category.test.ts` and `bouquet-and-centrepieces-have-a-slot.test.ts` hold it.
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
  | { kind: 'role'; key: 'bride' | 'wedding_party' }
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
};

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
     search from the photos uploaded by vendors"*): the two with a stored slot are drawn — the bride's
     card is the gown, the groom's slot (stored since onboarding, never drawn here) is the suit; each
     uploads and searches its own trades' photos through the shipped picker. The four with no slot of
     their own wait in `AWAITING_A_SLOT` below. */
  { slotKey: 'bride', label: 'Bridal gown', from: 'gown designers and make-up artists', target: { kind: 'role', key: 'bride' }, useLabel: 'Use for the bride’s colours', attire: true },
  { slotKey: 'groom', label: 'Groom’s suit', from: 'suit and barong makers', target: { kind: 'none' }, useLabel: null, attire: true },
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
  /* 👔 The owner's four attire boards (2026-10-08). Their photos would share the ONE `entourage` slot
     today; a board of their own each needs `event_inspiration_assets_slot_key_check` widened — a
     migration re-listing that CHECK vocabulary, which the owner's instruction says to stop on. Their
     trades are the entourage slot's own (`MOODBOARD_SLOT_TRADES.entourage`), nothing invented. */
  { label: 'Groomsmen', trades: ['mens_attire', 'filipiniana_barongs'] },
  { label: 'Bridesmaids', trades: ['womens_attire', 'filipiniana_barongs'] },
  { label: 'Flower girl', trades: ['womens_attire', 'filipiniana_barongs'] },
  { label: 'Ring bearer', trades: ['mens_attire', 'filipiniana_barongs'] },
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
