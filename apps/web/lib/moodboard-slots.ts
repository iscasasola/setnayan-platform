/**
 * The inspiration-slot vocabulary — `event_inspiration_assets.slot_key`.
 *
 * EXTRACTED from `app/dashboard/[eventId]/wizard-actions.ts` (MB2, 2026-09-03)
 * with no change to its contents. It moved for one reason: `wizard-actions.ts`
 * is a `'use server'` module, and the render-part registry
 * (`lib/moodboard-render-parts.ts`) has to DERIVE the place parts from this
 * list rather than restate them. A second hand-kept copy of these keys is
 * exactly the staleness the registry exists to prevent — the moment somebody
 * adds a slot, one copy would grow it and the other would not, and the failure
 * would be silent (a part the couple designed, with no way to render it).
 *
 * wizard-actions.ts now imports from here, so there is still one list.
 *
 * ⚠ THE DATABASE HOLDS THE SAME ALLOWLIST as a CHECK constraint
 * (`event_inspiration_assets_slot_key_check`, last widened by
 * `20271198640000_moodboard_inspiration_slot_cake.sql`). That pair predates
 * this file and is NOT collapsed here — a CHECK cannot read TypeScript. They
 * agree today; widen both together, and the DB is the one that fails loudly.
 */

// Types only — erased at compile time, so this module keeps its zero VALUE
// imports and stays reachable from a `'use client'` component.
import type { WeddingTile } from './taxonomy';

/**
 * 18 named slots. Grouped in the UI as Location feel (11) · Palette (1) ·
 * Dress codes (6) — see `_components/inspiration-board.tsx`.
 *
 * ⚠ `venue` is NOT renamed to `ceremony_venue`. Real rows carry that key from
 * onboarding Card 15 (migration 20260627000000) and a rename orphans every one.
 */
export const MOODBOARD_SLOT_KEYS = [
  'venue',
  'reception_venue',
  'backdrop',
  'tunnel',
  'stage',
  'table',
  'ceiling',
  'flowers',
  'cocktail',
  'cake',
  'overall',
  'palette',
  'groom',
  'bride',
  'principal_sponsor',
  'entourage',
  'parents',
  'guests',
] as const;

export type MoodboardSlotKey = (typeof MOODBOARD_SLOT_KEYS)[number];

/**
 * How many photos one slot holds. Owner, 2026-09-03, on how couples actually
 * use this: *"most of the time, they upload more that 1 design … it usually is
 * 1-3 designs"* — so the original 2-photo cap (20260627000000) cut off the top
 * of the real range and was widened to 3.
 *
 * ⚠ ONE SOURCE OF TRUTH, ON PURPOSE. This cap was once spelled SIX times — the
 * DB CHECK, two server-action validators, two copies of a `1 | 2` return type,
 * and a `[1, 2]` in the tile grid — with nothing tying them together. Five of
 * the six FAIL LOUDLY when they disagree; the sixth does not, and that is the
 * one that matters: `listMoodboardSlots`'s row filter SILENTLY DROPS a position
 * outside its list, so a widened DB plus a stale filter would store the
 * couple's third photo and never render it. Widen HERE and every gate moves.
 *
 * 🛑 IT LIVES IN THIS FILE, NOT IN `wizard-actions.ts`, FOR THE SAME REASON THE
 * SLOT KEYS DO — and MB10 is what proved the reason is real, not tidiness.
 * `wizard-actions.ts` is a `'use server'` module, and Next refuses to build
 * when one server module imports a non-function VALUE out of another:
 *
 *     A "use server" file can only export async functions, found object.
 *
 * The const had sat exported from there for months without complaint, because
 * its only value-importer was a CLIENT component — a direction Next permits.
 * The moment `studio/mood-board/actions.ts` (also `'use server'`) needed it to
 * validate a gallery pick's position, the whole `/dashboard/[eventId]/studio/
 * mood-board` route failed to build. `tsc --noEmit`, 12,593 unit tests and the
 * full db replay were all green through it: only `next build` can see this.
 */
export const MOODBOARD_SLOT_POSITIONS = [1, 2, 3] as const;
export type MoodboardSlotPosition = (typeof MOODBOARD_SLOT_POSITIONS)[number];
export const MOODBOARD_MAX_PHOTOS_PER_SLOT = MOODBOARD_SLOT_POSITIONS.length;

export function isMoodboardSlotPosition(value: unknown): value is MoodboardSlotPosition {
  return (MOODBOARD_SLOT_POSITIONS as readonly number[]).includes(Number(value));
}

/**
 * The inspiration slot that belongs to each reception-design part — the bridge
 * that lets the couple see the photo they uploaded beside the zone they are
 * dressing.
 *
 * ⚠ FIVE OF TEN PARTS, NOT ALL OF THEM. The two vocabularies were written for
 * different jobs and only partly overlap: `walls`, `photo_wall`,
 * `welcome_signage`, `entrance` and `people` have no inspiration slot, and
 * `venue`, `reception_venue`, `flowers`, `cocktail`, `cake`, `overall`,
 * `palette` and the six attire slots have no design part. An absent entry is
 * the honest answer for those — the alternative is guessing a couple's cake
 * photo describes their ceiling.
 *
 * ⚠ `table` IS SINGULAR AND THE PART IS PLURAL. That mismatch is the entire
 * reason this map is explicit rather than `slot === part`. Renaming either side
 * to make them match would orphan live rows (`MOODBOARD_SLOT_KEYS` above says
 * why `venue` was never renamed) — so the bridge absorbs it instead.
 */
export const INSPIRATION_SLOT_FOR_PART: Readonly<Record<string, MoodboardSlotKey>> = {
  ceiling: 'ceiling',
  backdrop: 'backdrop',
  stage: 'stage',
  tunnel: 'tunnel',
  tables: 'table',
};

/** The inspiration slot for a design part, or null when the part has none. */
export function inspirationSlotForPart(partId: string): MoodboardSlotKey | null {
  return INSPIRATION_SLOT_FOR_PART[partId] ?? null;
}

/**
 * THE EIGHT ORPHANED DESIGN PARTS, AND THE TRADE THAT SIGNS EACH ONE OFF (MB16).
 *
 * 🔑 A DIFFERENT QUESTION FROM `MOODBOARD_SLOT_TRADES`, WHICH IS WHY IT IS A
 * SEPARATE MAP AND NOT FOUR MORE ROWS OF THAT ONE. MB10's map answers *"which
 * trades may UPLOAD to this inspiration slot"*; this one answers *"which trade
 * can be asked to AGREE to this design part"*. For the twelve parts that alias
 * a slot the two coincide, and `tradesForPart` composes MB10's map through
 * MB2's part → slot join to get them — never a second opinion.
 *
 * But eight parts alias NO slot (`INSPIRATION_SLOT_FOR_PART` above says so in
 * its own docblock: `walls`, `photo_wall`, `welcome_signage`, `entrance` have
 * none, and neither do the four attire roles below). For those the composition
 * has nothing to compose, and MB12 shipped them as permanently un-finalizable
 * with the note that the fix was to *"give those slots a trade in
 * `MOODBOARD_SLOT_TRADES`"*. That sentence was wrong, and this map is the
 * correction: they have no slot to give a trade TO, and
 * `MOODBOARD_SLOT_TRADES` is typed `Record<MoodboardSlotKey, …>`, so adding
 * `walls` to it does not compile. Widening `MoodboardSlotKey` instead would
 * cascade into the DB CHECK `event_inspiration_assets_slot_key_check`,
 * `GALLERY_SLOT_LABEL`, the couple's picker and the per-slot upload quota — to
 * express a fact about sign-off that has nothing to do with uploads.
 *
 * ⚠ KEYED BY THE NAMESPACED RENDER-PART ID, unlike its sibling above, which is
 * keyed by a bare `RECEPTION_PARTS` id. This map spans BOTH room zones and
 * attire roles, and `bride` is a real member of each vocabulary — the
 * namespace is what `lib/moodboard-render-parts.ts` invented for exactly that
 * collision. Keys are plain strings so this file keeps its zero imports;
 * `lib/moodboard-finalization.ts` asserts at module load that every key is a
 * real part AND that the part has no slot-derived trades, so this map can
 * never become a second opinion about a part that already has one.
 *
 * ⚠ VALUES ARE `WeddingTile`s, NOT CANONICAL SERVICE KEYS. `filipiniana_terno`,
 * `barong_tagalog_custom` and their siblings are canonicals living UNDER the
 * `brides_attire` / `grooms_attire` / `filipiniana_barongs` tiles, and
 * `canonicalServicesForSlot` expands a tile into them. Naming the tile reaches
 * every canonical it holds — including the Muslim, Maranao, Tausug and Yakan
 * attire — so "whichever matches the couple's ceremony" is resolved by
 * intersecting with the SHOP's own `services[]` at read time, exactly the way
 * the existing attire parts resolve. There is no ceremony-type branch anywhere
 * in that path and this map does not invent one.
 *
 * ⚠ AND NO PART DEPENDS ON `filipiniana_barongs` ALONE. It is a cross-view
 * tile, so its canonical list is assembled by an explicit `map.set` in
 * `lib/vendor-counts.ts` rather than by the ordinary tile derivation — a
 * fragile shape. Measured on 2026-09-04 it resolves to 10 canonicals, so it is
 * NOT empty; but every row below also carries `mens_attire` and/or
 * `womens_attire`, so if a later session did empty it, these parts would
 * narrow rather than go dark.
 *
 * Owner-decided 2026-09-04.
 */
export const MOODBOARD_PART_TRADES: Readonly<Record<string, readonly WeddingTile[]>> = {
  // ── the four room zones nobody could sign off on ──
  // A wall, a doorway, a photo wall and a welcome sign are all things a
  // stylist/decorator builds. Nothing else in the marketplace does.
  'room:walls': ['stylist_decorator'],
  'room:welcome_signage': ['stylist_decorator'],
  'room:entrance': ['stylist_decorator'],
  'room:photo_wall': ['stylist_decorator'],

  // ── the three celebration zones (2026-09-06) ──
  // Unlike the four above, these are NOT things a stylist builds — they are
  // things a SUPPLIER brings, and the trade that agrees to how a buffet or a
  // band looks is the trade that provides it. That is the same rule the
  // officiant row below states from the other side.
  //
  // 🔑 EVERY TILE A COUPLE CAN CHOOSE IN THAT ZONE IS LISTED, not a
  // representative sample. `canonicalServicesForPart` is what puts an Ask
  // button in front of a real shop; a couple who picks a perfume bar and gets
  // offered a photo-booth vendor has been sent to the wrong supplier, and the
  // finalization screen would still look perfectly healthy. Ordered
  // most-characteristic first, because the first tile a shop matches is the
  // one printed on the credit.
  'room:feast': [
    'catering',
    'stations',
    'cake',
    'dessert',
    'mobile_bar',
    'mocktail',
    'coffee_espresso',
    'food_cart',
    'food_truck',
  ],
  'room:program': [
    'live_band',
    'dj',
    'host_mc',
    'orchestra',
    'wedding_singer',
    'choir',
    'av_production',
    'dance_floor',
  ],
  'room:booths': [
    'photo_booth',
    'arcade_games',
    'caricature_calligraphy_painting',
    'henna_tattoo',
    'massage_chair',
    'mini_nail_bar',
    'perfume_bar',
    'tarot_astrology_palmistry',
    'engraving_embroidery',
  ],

  // ── the four attire roles nobody could sign off on ──
  // Ordered MOST characteristic first, the same rule MOODBOARD_SLOT_TRADES
  // states: the first tile a shop matches is the one printed on the credit.
  //
  // The Nikah cast. `filipiniana_barongs` leads because it is the tile
  // carrying muslim_modest_bridal / maranao / tausug / yakan attire.
  'people:muslim_principals': ['filipiniana_barongs', 'womens_attire', 'mens_attire'],
  // Cord, veil and candle sponsors dress like the principal sponsors, whose
  // inspiration slot already resolves to exactly these three.
  'people:secondary_sponsors': ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  // `womens_attire` holds flower_girl_dress and `mens_attire` holds
  // ring_bearer_suit — the two halves of this one part, and the reason it is
  // narrower than the sponsors above.
  'people:bearers_flower_girl': ['womens_attire', 'mens_attire'],
  // Vestments. The `officiants` TILE is the officiant's own service (marrying
  // people), not a tailor, so it is deliberately NOT here — the trade that
  // agrees to the COLOUR of a vestment is the trade that makes it.
  'people:officiants': ['mens_attire', 'womens_attire', 'filipiniana_barongs'],
};

/** The trades that can sign off a part with no inspiration slot — empty for
 *  every part that has one, whose trades are composed from MB10's map. */
export function orphanPartTrades(partId: string): readonly WeddingTile[] {
  return MOODBOARD_PART_TRADES[partId] ?? [];
}

export function isMoodboardSlotKey(value: unknown): value is MoodboardSlotKey {
  return (
    typeof value === 'string' && (MOODBOARD_SLOT_KEYS as readonly string[]).includes(value)
  );
}
