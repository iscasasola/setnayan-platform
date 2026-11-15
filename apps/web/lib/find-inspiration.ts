/**
 * lib/find-inspiration.ts — 💡 THE INSPIRATION BOX IN SUPPLIERS › FIND (reorg R5).
 *
 * Owner rulings: 2026-10-27 "THE INSPIRATION BOX MOVES TO SUPPLIERS" · 2026-10-28 *"on find"* ("INSPIRATION LIVES IN
 * SUPPLIERS › FIND") · 2026-10-28 "INSPIRATION IN FIND — FINAL FRAMES A–F APPROVED". Prototype
 * `prototypes/inspiration_in_find_2026-10-28/` (corpus). Inspiration hangs off the taxonomy (Category › Part), so it
 * lives INSIDE each category, above that category's suppliers:
 *
 *   A · one row on top of Find — "Your inspiration board": a photo stack and "N photos · N parts · N from your
 *       suppliers"; it opens the whole board;
 *   B · a category opened — an Inspiration strip first: one tile per Part that holds photos (its cover, its name,
 *       "N photos", "On your list" when a photo came from a supplier already on the couple's list), ＋ Add a part last;
 *   (the ✎ "What to show" sheet) — each service's looks nest under it (`data-find-looks`): the parts that service
 *       supplies (`inspiration_part_services`), with the couple's count.
 *
 * NOTHING NEW IS STORED. The photos are the couple's shipped `event_inspiration_assets` (one per part slot, `slot_key`);
 * a photo picked from a supplier's gallery carries `library_asset_id` → `moodboard_library_assets.vendor_profile_id`.
 * The parts and their categories are the admin's (`getInspirationParts` · `partCategories`).
 *
 * 🔑 A REFUSED READ IS NEVER AN EMPTY BOARD: `photos: null` → `read: 'unread'`, said in words by the row and the strip,
 * never "0 photos". Pure — no React, no I/O. Held by `lib/inspiration-lives-in-find.test.ts`.
 */
import { formatCount } from './format-number';
import { partCategories, type InspirationPart } from './inspiration-parts';

/** One of the couple's inspiration photos, as the Find page reads it. */
export type FindInspirationPhoto = {
  slotKey: string;
  imageUrl: string;
  /** Picked from a supplier's gallery (`library_asset_id` set) — even when that shop can no longer be read. */
  fromSupplier: boolean;
  /** The supplier whose gallery it was picked from, when readable; else null. */
  vendorProfileId: string | null;
  /** 🔗 The service card the supplier filed it under (`moodboard_library_assets.vendor_service_id`, migration
   *  `20271297295494`) — null when it fits no card, or the link could not be read. */
  vendorServiceId?: string | null;
};

/**
 * 💗 ONE LIKED PHOTO IN AN OPENED CATEGORY (owner 2026-11-12, the organized-Find prototype: "Liked ideas link to the
 * exact card"). `shop` + `card` given → "From <shop> · <card> ›", the card itself; `shop` alone → that shop; neither →
 * a community photo, "Find who does this ›". `onList` → the shop is already on the couple's list (no Ask button).
 */
export type FindLikedPhoto = {
  /** The board tile's own key (`event_inspiration_assets.slot_key`) + its address — unique per photo. */
  key: string;
  imageUrl: string;
  /** The part it sits on ("Table setting"). */
  part: string;
  vendorProfileId: string | null;
  /** The shop's DISPLAY name (hybrid anonymity resolved on the server) — null = unreadable or a community photo. */
  shop: string | null;
  serviceId: string | null;
  /** The card's title — null when the photo has no card, or it could not be read. */
  card: string | null;
  onList: boolean;
};

/** The names the server could read for the liked photos' shops and cards (ids → words). */
export type FindLikedNames = {
  shops: ReadonlyMap<string, string>;
  cards: ReadonlyMap<string, string>;
};

/** One part's tile on a category's strip. */
export type FindInspirationPart = {
  slotKey: string;
  label: string;
  count: number;
  /** The newest photo's address — the tile's cover. */
  cover: string | null;
  /** A photo in it came from a supplier already on the couple's list. */
  onList: boolean;
  /** The shop services that supply this part (the ✎ sheet nests it under each). */
  services: readonly string[];
};

export type FindInspiration =
  | { read: 'unread' }
  | {
      read: 'ok';
      /** Every photo on the board. */
      photos: number;
      /** The parts holding at least one photo. */
      parts: number;
      /** Photos picked from a supplier's gallery. */
      fromSuppliers: number;
      /** Up to three covers for the row's photo stack, newest first. */
      covers: readonly string[];
      /** Category (`WeddingTile`) → its parts that hold photos, in the admin's order. */
      byTile: Readonly<Record<string, readonly FindInspirationPart[]>>;
      /** Every part with photos, by key — the ✎ sheet's looks. */
      looks: readonly FindInspirationPart[];
      /** Every category that has a part at all — its opened row draws the strip (＋ Add a part, even with no photos). */
      partTiles: readonly string[];
      /** 💗 Category → the couple's liked photos there, newest first, each with the shop and card it came from. */
      liked: Readonly<Record<string, readonly FindLikedPhoto[]>>;
    };

/** The board for Find. `photos` newest first; `null` = the read was refused. */
export function buildFindInspiration(
  parts: readonly InspirationPart[],
  photos: readonly FindInspirationPhoto[] | null,
  onList: ReadonlySet<string>,
  names: FindLikedNames | null = null,
): FindInspiration {
  if (photos === null) return { read: 'unread' };
  const liked: Record<string, FindLikedPhoto[]> = {};
  const bySlot = new Map<string, FindInspirationPhoto[]>();
  for (const p of photos) {
    const list = bySlot.get(p.slotKey) ?? [];
    list.push(p);
    bySlot.set(p.slotKey, list);
  }
  const byTile: Record<string, FindInspirationPart[]> = {};
  const looks: FindInspirationPart[] = [];
  const partTiles = new Set<string>();
  for (const part of parts) {
    if (part.kind !== 'part') continue;
    if (!part.hidden) for (const cat of partCategories(part)) partTiles.add(cat);
    const mine = bySlot.get(part.slotKey) ?? [];
    if (mine.length === 0) continue;
    const tile: FindInspirationPart = {
      slotKey: part.slotKey,
      label: part.label,
      count: mine.length,
      cover: mine[0]?.imageUrl ?? null,
      onList: mine.some((p) => p.vendorProfileId !== null && onList.has(p.vendorProfileId)),
      services: part.services ?? [],
    };
    looks.push(tile);
    for (const cat of partCategories(part)) (byTile[cat] ??= []).push(tile);
    const likedHere: FindLikedPhoto[] = mine.map((p, i) => {
      const shop = p.vendorProfileId ? (names?.shops.get(p.vendorProfileId) ?? null) : null;
      const serviceId = shop ? (p.vendorServiceId ?? null) : null;
      return {
        key: `${p.slotKey}|${i}|${p.imageUrl}`,
        imageUrl: p.imageUrl,
        part: part.label,
        vendorProfileId: shop ? p.vendorProfileId : null,
        shop,
        serviceId,
        card: serviceId ? (names?.cards.get(serviceId) ?? null) : null,
        onList: p.vendorProfileId !== null && onList.has(p.vendorProfileId),
      };
    });
    for (const cat of partCategories(part)) (liked[cat] ??= []).push(...likedHere);
  }
  return {
    read: 'ok',
    photos: photos.length,
    parts: looks.length,
    fromSuppliers: photos.filter((p) => p.fromSupplier).length,
    covers: photos.slice(0, 3).map((p) => p.imageUrl),
    byTile,
    looks,
    partTiles: [...partTiles],
    liked,
  };
}

/** 💗 The liked photos of one category — [] when none, or the board could not be read. */
export function likedForTile(board: FindInspiration | null, tile: string): readonly FindLikedPhoto[] {
  if (!board || board.read !== 'ok') return [];
  return board.liked[tile] ?? [];
}

/** "Nothing liked for Catering yet." — an opened category with no liked photo. */
export function likedEmptyLine(label: string): string {
  return `Nothing liked for ${label} yet.`;
}

/** "From Kusina ni Lola · Full buffet ›" — or the shop alone when the photo has no card. */
export function likedFromLine(p: FindLikedPhoto): string | null {
  if (!p.shop) return null;
  return p.card ? `From ${p.shop} · ${p.card}` : `From ${p.shop}`;
}

/**
 * The source line under a liked photo with no readable name. A photo with NO shop is a community photo; a photo from
 * a real shop whose name could not be read says so — calling it "Community photo" would be false (reads are honest).
 */
export function likedSourceWord(p: Pick<FindLikedPhoto, 'vendorProfileId'>): string {
  return p.vendorProfileId ? FIND_INSPIRATION_WORDS.sourceUnread : FIND_INSPIRATION_WORDS.community;
}

/**
 * The card a liked photo's "From <shop> · <card> ›" opens: the card the photo was FILED UNDER. The shop's saved card is
 * used only when it IS that card (or the photo names no card) — never a different card of the same shop, which would
 * open "Full buffet" for a "Grazing table" photo. No match → no card (the sheet says less, never something false).
 */
export function likedCardFor<C extends { serviceId?: string }>(photoServiceId: string | null, saved: C | null): C | null {
  if (!photoServiceId) return saved;
  return saved?.serviceId === photoServiceId ? saved : null;
}

/** The parts a service supplies, with photos — the looks nested under it in the ✎ sheet. */
export function looksForService(board: FindInspiration | null, serviceKey: string): readonly FindInspirationPart[] {
  if (!board || board.read !== 'ok') return [];
  return board.looks.filter((l) => l.services.includes(serviceKey));
}

const n = (k: number, one: string, many: string) => `${formatCount(k)} ${k === 1 ? one : many}`;

/** THE WORDS — one place, so the row, the strip and the sheet say the same thing. */
export const FIND_INSPIRATION_WORDS = {
  rowTitle: 'Your inspiration board',
  stripHead: 'Inspiration',
  seeAll: 'See all',
  addPart: 'Add a part',
  onList: 'On your list',
  emptyRow: 'Save the looks you love — a bouquet, an arch, a cake.',
  unread: 'We couldn’t read your inspiration board — reload in a moment.',
  info:
    'Your inspiration board holds the looks you love, filed by part — a bouquet under Flowers, an arch under Styling. ' +
    'Each category shows its parts above its suppliers. A look you saved from a supplier is marked “On your list” ' +
    'when that supplier is on your list.',
  sheetTitle: 'Your inspiration board',
  // 💗 The opened category (owner 2026-11-12, the organized-Find prototype).
  likedHead: 'Liked ideas',
  community: 'Community photo',
  /** A shop's photo whose name could not be read — never called a community photo (that would be false). */
  sourceUnread: 'Couldn’t load the supplier',
  findWho: 'Find who does this',
  ideasHead: 'Ideas',
  moreIdeas: 'More ideas',
} as const;

/** "24 photos · 6 parts · 3 from your suppliers" — the row's second line. */
export function inspirationRowLine(board: FindInspiration): string {
  if (board.read === 'unread') return FIND_INSPIRATION_WORDS.unread;
  if (board.photos === 0) return FIND_INSPIRATION_WORDS.emptyRow;
  const bits = [n(board.photos, 'photo', 'photos'), n(board.parts, 'part', 'parts')];
  if (board.fromSuppliers > 0) bits.push(`${formatCount(board.fromSuppliers)} from your suppliers`);
  return bits.join(' · ');
}

/** "4 photos" under a part's tile. */
export function partCountLine(count: number): string {
  return n(count, 'photo', 'photos');
}

/** The board's own address: Find with the board open (a sheet — no new route). */
export const FIND_BOARD_PARAM = 'board';
export function findBoardHref(eventId: string): string {
  return `/dashboard/${eventId}/vendors?${FIND_BOARD_PARAM}=1`;
}
