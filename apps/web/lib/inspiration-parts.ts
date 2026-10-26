/**
 * lib/inspiration-parts.ts — THE INSPIRATION PARTS, AS ONE SNAPSHOT (PLAN
 * `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 2, step ②; owner-approved 2026-10-26).
 *
 * One list answers every "which parts are there, what are they called, who supplies them" question —
 * the couple's "Which part?", the supplier's `Part ▾`, and (step ③) the admin's list. It lives in
 * `public.inspiration_parts` + `public.inspiration_part_categories` (migration
 * `20271287668170_inspiration_parts_on_the_taxonomy.sql`), read once per request by
 * `getInspirationParts()` (`lib/inspiration-parts-db.ts`), which falls back to `fallbackInspirationParts()`
 * here — built from the consts the table was seeded from — exactly as `getTaxonomy()` falls back to
 * `lib/taxonomy.ts`.
 *
 * PURE AND CLIENT-SAFE: types only from the taxonomy, values only from `./moodboard-slots`. A server page
 * hands its snapshot to a client component as a prop. 🛑 No helper defaults to `fallbackInspirationParts()`
 * any more (③0-b, PLAN `admin_taxonomy_four_levels_2026-10-26` § 8.3): a caller that means the consts (a dev
 * lab, the seed generator, a module-load structural assert) names it, so a forgotten snapshot is a type
 * error, not a silent read of the seed.
 *
 * 🔑 A PART'S SUPPLIERS ARE TIER-2 CATEGORIES — its HOME first, then "also from" in order (the first tile a
 * shop matches is the one printed on the credit). `partCategories()` is the one place that order is read.
 */
import type { WeddingTile } from './taxonomy';
import { MOODBOARD_SLOT_KEYS, type MoodboardSlotKey } from './moodboard-slots';

/** One part, as the table holds it. `slotKey` is permanent — the photos carry it. */
export type InspirationPart = {
  slotKey: string;
  label: string;
  /** 'system' = the palette: a colour reference is nobody's portfolio, so no category supplies it. */
  kind: 'part' | 'system';
  homeCategoryId: string | null;
  alsoCategoryIds: readonly string[];
  /** Hidden from couples (never offered for a new photo). Suppliers' shelves are unaffected. */
  hidden: boolean;
  sortOrder: number;
};

export type InspirationPartsSnapshot = {
  /** Which path answered — the database, or the consts because the read failed or found nothing. */
  source: 'db' | 'fallback';
  parts: readonly InspirationPart[];
};

/**
 * Which marketplace trades supply each inspiration slot — 🧩 THE FALLBACK SEED ONLY since step ② (PLAN
 * `admin_inspiration_groups_2026-10-25`): `inspiration_parts.home_category_id` (the first tile) +
 * `inspiration_part_categories` (the rest, in order) are the live answer, read by `getInspirationParts()`;
 * this map is what that reader falls back to, and what the seed was generated from. MOVED here from
 * `lib/moodboard-gallery.ts` (which re-exports it) so the fallback is client-safe.
 *
 * Ordered MOST characteristic first: the first tile a shop matches is the one
 * printed on the credit, so `flowers` leads with `florist` and `table` leads
 * with `stylist_decorator` (a stylist dresses the table; a florist supplies
 * one thing on it).
 */
export const MOODBOARD_SLOT_TRADES: Readonly<
  Record<MoodboardSlotKey, readonly WeddingTile[]>
> = {
  // ── the place ──
  venue: ['ceremony_venue'],
  reception_venue: ['reception'],
  // ── what the room is dressed with ──
  backdrop: ['stylist_decorator', 'led_wall'],
  tunnel: ['stylist_decorator'],
  stage: ['stylist_decorator', 'av_production', 'lights_sound'],
  table: ['stylist_decorator', 'florist'],
  ceiling: ['stylist_decorator', 'lights_sound'],
  flowers: ['florist', 'stylist_decorator'],
  cocktail: ['mobile_bar', 'mocktail', 'coffee_espresso'],
  cake: ['cake', 'dessert'],
  // 💐 The owner's two parts, on the taxonomy tiles they already map to (step 4c).
  bridal_bouquet: ['florist'],
  centrepieces: ['florist', 'stylist_decorator', 'catering'],
  // 🎨🖼 The Palette's five parts with photos of their own (2026-10-19), on the tiles that dress them.
  chairs: ['chairs_tents', 'stylist_decorator'],
  ribbons_candles: ['stylist_decorator'],
  lights: ['lights_sound', 'stylist_decorator'],
  entourage_bouquets: ['florist'],
  flower_accents: ['florist', 'stylist_decorator'],
  overall: ['reception', 'stylist_decorator', 'lights_sound', 'coordinator'],
  // 🔑 NOT A TRADE. A palette source is a photo the couple sampled colours
  // from — a wall, a fabric, a sunset. No shop's portfolio answers it.
  palette: [],
  // ── what people wear. HMUA rides with `bride` because a bridal-hair photo
  //    and a gown photo are the same picture. ──
  bride: ['brides_attire', 'filipiniana_barongs', 'hmua'],
  groom: ['grooms_attire', 'mens_attire', 'filipiniana_barongs'],
  principal_sponsor: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  entourage: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  // 👗 The four attire boards (owner 2026-10-08), each on the entourage's OWN
  // tiles and nothing invented: the women's half for the bridesmaids, the men's
  // half for the groomsmen. 🧒 THERE IS NO CHILDREN'S-ATTIRE TILE in the taxonomy
  // — a flower girl's dress is a service under Women's Attire
  // (`flower_girl_dress`) and a ring bearer's suit one under Men's Attire
  // (`ring_bearer_suit`) — so those two boards name the tile that holds theirs.
  // `filipiniana_barongs` rides with all four (a barong or a Filipiniana is cut
  // for a page boy and a flower girl too), as it does with the entourage.
  bridesmaids: ['womens_attire', 'filipiniana_barongs'],
  groomsmen: ['mens_attire', 'filipiniana_barongs'],
  flower_girl: ['womens_attire', 'filipiniana_barongs'],
  ring_bearer: ['mens_attire', 'filipiniana_barongs'],
  parents: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
  guests: ['womens_attire', 'mens_attire', 'filipiniana_barongs'],
};


/**
 * The fallback's names and order — what `inspiration_parts.label_en` / `sort_order` / `hidden` were seeded
 * with. A `Record` over the FULL slot union, so a slot added to `MOODBOARD_SLOT_KEYS` is a compile error
 * here until somebody names it. The names are the ones a supplier reads today: the couple's part name where
 * the couple's Studio draws the part ("Walls", "Table linens", "Lights · warmth"), else the shelf's name
 * ("Ceremony venue"). `lib/every-palette-part-reaches-the-supplier-library.test.ts` (test 2) holds the first
 * half equal to the couple's Palette-lane and Attire names, so the fallback cannot drift from what the Studio draws.
 */
export const INSPIRATION_PART_FALLBACK: Readonly<
  Record<MoodboardSlotKey, { label: string; order: number; hidden?: true }>
> = {
  overall: { label: 'Venue & decor', order: 10 },
  stage: { label: 'Stage', order: 20 },
  ceiling: { label: 'Ceiling', order: 30 },
  backdrop: { label: 'Walls', order: 40 },
  tunnel: { label: 'Tunnel', order: 50 },
  table: { label: 'Table linens', order: 60 },
  chairs: { label: 'Chairs', order: 70 },
  ribbons_candles: { label: 'Ribbons & candles', order: 80 },
  lights: { label: 'Lights · warmth', order: 90 },
  bridal_bouquet: { label: 'Bridal bouquet', order: 100 },
  entourage_bouquets: { label: 'Entourage bouquets', order: 110 },
  centrepieces: { label: 'Centrepieces', order: 120 },
  flower_accents: { label: 'Accents', order: 130 },
  cake: { label: 'Cake', order: 140 },
  bride: { label: 'Bridal gown', order: 150 },
  groom: { label: 'Groom’s suit', order: 160 },
  bridesmaids: { label: 'Bridesmaids', order: 170 },
  groomsmen: { label: 'Groomsmen', order: 180 },
  flower_girl: { label: 'Flower girl', order: 190 },
  ring_bearer: { label: 'Ring bearer', order: 200 },
  // The older shelves (the supplier's "More boards") — no couple's Studio card draws them.
  venue: { label: 'Ceremony venue', order: 210 },
  reception_venue: { label: 'Reception venue', order: 220 },
  // The legacy every-flower board: never offered to a couple for a new photo (`LEGACY_PALETTE_BOARDS`).
  flowers: { label: 'Flowers', order: 230, hidden: true },
  cocktail: { label: 'Cocktail hour', order: 240 },
  principal_sponsor: { label: 'Principal sponsors’ attire', order: 250 },
  entourage: { label: 'Entourage attire', order: 260 },
  parents: { label: 'Parents’ attire', order: 270 },
  guests: { label: 'Guest attire', order: 280 },
  // 🔑 The system part — no supplying trade (`MOODBOARD_SLOT_TRADES.palette` is empty).
  palette: { label: 'Palette', order: 290, hidden: true },
};

let fallbackMemo: InspirationPartsSnapshot | null = null;

/** The consts as a snapshot — what the table was seeded with, byte for byte. */
export function fallbackInspirationParts(): InspirationPartsSnapshot {
  if (fallbackMemo) return fallbackMemo;
  const parts: InspirationPart[] = MOODBOARD_SLOT_KEYS.map((slotKey) => {
    const [home, ...also] = MOODBOARD_SLOT_TRADES[slotKey];
    const f = INSPIRATION_PART_FALLBACK[slotKey];
    return {
      slotKey,
      label: f.label,
      kind: home ? 'part' : 'system',
      homeCategoryId: home ?? null,
      alsoCategoryIds: also,
      hidden: f.hidden === true,
      sortOrder: f.order,
    };
  });
  fallbackMemo = { source: 'fallback', parts: sortParts(parts) };
  return fallbackMemo;
}

function sortParts(parts: InspirationPart[]): InspirationPart[] {
  return parts.sort((a, b) => a.sortOrder - b.sortOrder || a.slotKey.localeCompare(b.slotKey));
}

/** A row of `inspiration_parts`, as selected by the reader. */
export type InspirationPartRow = {
  slot_key: string;
  label_en: string;
  kind: string;
  home_category_id: string | null;
  sort_order: number;
  hidden: boolean;
  status: string;
};
/** A row of `inspiration_part_categories`. */
export type InspirationPartCategoryRow = { slot_key: string; category_id: string; sort_order: number };

/**
 * The two tables as one snapshot — pure, so the shaping unit-tests without a database. A retired part is
 * not a part (it is offered nowhere); its photos keep their rows and their key.
 */
export function snapshotFromPartRows(
  rows: readonly InspirationPartRow[],
  links: readonly InspirationPartCategoryRow[],
): InspirationPartsSnapshot {
  const also = new Map<string, InspirationPartCategoryRow[]>();
  for (const l of links) {
    const list = also.get(l.slot_key) ?? [];
    list.push(l);
    also.set(l.slot_key, list);
  }
  const parts: InspirationPart[] = rows
    .filter((r) => r.status !== 'retired')
    .map((r) => ({
      slotKey: r.slot_key,
      label: r.label_en,
      kind: r.kind === 'system' ? 'system' : 'part',
      homeCategoryId: r.home_category_id,
      alsoCategoryIds: (also.get(r.slot_key) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order || a.category_id.localeCompare(b.category_id))
        .map((l) => l.category_id),
      hidden: r.hidden,
      sortOrder: r.sort_order,
    }));
  return { source: 'db', parts: sortParts(parts) };
}

/** Every part, in the admin's order. */
export function inspirationPartsInOrder(snapshot: InspirationPartsSnapshot): readonly InspirationPart[] {
  return snapshot.parts;
}

/** The part with this key, or null. */
export function inspirationPart(snapshot: InspirationPartsSnapshot, slotKey: string): InspirationPart | null {
  return snapshot.parts.find((p) => p.slotKey === slotKey) ?? null;
}

/** TRUE when the key names a part — the validator every write path asks (the DB's FK is the floor). */
export function isInspirationPartKey(snapshot: InspirationPartsSnapshot, value: unknown): value is string {
  return typeof value === 'string' && snapshot.parts.some((p) => p.slotKey === value);
}

/**
 * The categories that supply a part — HOME first, then "also from" in order, de-duped; empty for a system
 * part. Typed `WeddingTile` because every reader expands them through the TS taxonomy; a category an admin
 * added that the TS taxonomy does not know yet expands to no canonical service, so it grants nothing
 * until it does — never something wrong.
 */
export function partCategories(part: InspirationPart | null): readonly WeddingTile[] {
  if (!part || part.kind === 'system') return [];
  const out: string[] = [];
  for (const c of [part.homeCategoryId, ...part.alsoCategoryIds]) if (c && !out.includes(c)) out.push(c);
  return out as WeddingTile[];
}
