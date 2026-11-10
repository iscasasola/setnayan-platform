/**
 * 🖼 THE SUPPLIER HERO'S PHOTO — which picture each of the three heads wears (Build 3 Lane E, items 10–12;
 * prototype `supplier_shop_portfolio_2026-11-09` § 0). Pure: the page reads, this decides.
 *
 *   Today     = the MOST VIEWED portfolio photo (`vendor_portfolio_photo_views`, migration 20271331531509);
 *               ties → the latest; no views yet → the latest photo.
 *   Shop      = the cover photo (the shipped `shop-cover.tsx` rule, unchanged: Your page's pick, else the first photo).
 *   Portfolio = the latest photo uploaded.
 *   No photo  = a PLACEHOLDER, never a bare surface (owner: "If no existing photo, we need to give them
 *               placeholders"): the picture of the shop's own category from Admin › Categories, else its parent
 *               group's, else the shipped `/placeholders/vendor.webp`. It is captioned "Sample photo · Upload yours"
 *               by the hero, so it never passes as the supplier's own work.
 *
 * "Latest" = the LAST entry of `vendor_profiles.portfolio_r2_keys`: the uploader appends (Portfolio's own "newest
 * first" list is that array reversed — `collections/page.tsx`).
 * 🔒 lib/supplier-hero.test.ts
 */

/** The shipped placeholder file — the last link of the chain. */
export const HERO_PLACEHOLDER_FILE = '/placeholders/vendor.webp';

/**
 * 🖼 THE SHOP'S COVER PHOTO — the ONE rule (Your page's pick while it is still on the portfolio, else the first
 * portfolio photo; null when there is none). Shop's hero (`vendor-dashboard/shop/page.tsx`) and Discover's shop card
 * (`app/_components/frontdoor/data.ts`, owner 10 Nov "DISCOVER'S SHOP CARD — APPROVED") both ask THIS, so the card
 * opens on the same picture the shop page does. 🔒 app/_components/frontdoor/the-shop-card-wears-the-shop.test.ts
 */
export function shopCoverKey(portfolio: readonly string[] | null | undefined, pick: string | null | undefined): string | null {
  const k = (portfolio ?? []).filter(Boolean);
  if (pick && k.includes(pick)) return pick;
  return k[0] ?? null;
}

/** Whether the cover is Your page's pick (true) or the first photo (false) — Shop's hero caption. */
export function coverIsYourPagePick(portfolio: readonly string[] | null | undefined, pick: string | null | undefined): boolean {
  return Boolean(pick) && shopCoverKey(portfolio, pick) === pick;
}

/** The latest photo: the last key of the portfolio array (null when there is none). */
export function latestPhotoKey(keys: readonly string[] | null | undefined): string | null {
  const k = (keys ?? []).filter(Boolean);
  return k.length > 0 ? k[k.length - 1]! : null;
}

/**
 * Today's photo: the portfolio key with the most views. Ties go to the LATER photo; a shop whose photos have no views
 * yet — or whose counts could not be read (`views === null`) — falls back to the latest photo. A count for a key that
 * is no longer on the portfolio is ignored (a removed photo never comes back as the hero).
 */
export function mostViewedPhotoKey(keys: readonly string[] | null | undefined, views: ReadonlyMap<string, number> | null): string | null {
  const k = (keys ?? []).filter(Boolean);
  if (k.length === 0) return null;
  if (!views || views.size === 0) return latestPhotoKey(k);
  let best: string | null = null;
  let bestViews = 0;
  k.forEach((key) => {
    const n = views.get(key) ?? 0;
    // `>=` walks forward, so an equal count later in the array (a newer photo) wins the tie.
    if (n > 0 && n >= bestViews) {
      best = key;
      bestViews = n;
    }
  });
  return best ?? latestPhotoKey(k);
}

/** The views on the chosen key, for the "Most viewed · N views" caption (0 when it fell back to the latest). */
export function viewsOf(key: string | null, views: ReadonlyMap<string, number> | null): number {
  return key && views ? (views.get(key) ?? 0) : 0;
}

/**
 * The placeholder chain's stored refs, in order: the category's own picture, then its parent group's. The caller
 * resolves the first that signs, else `HERO_PLACEHOLDER_FILE`. `category` is the shop's first service tile (the one
 * taxonomy — `TAXONOMY_MAP[canonical].tile`, never hard-coded); `photos` / `parentOf` are the taxonomy snapshot's.
 */
export function placeholderRefs(
  tile: string | null,
  photos: Readonly<Record<string, string | null>>,
  parentOf: Readonly<Record<string, string>>,
): string[] {
  if (!tile) return [];
  const own = photos[tile] ?? null;
  const parent = parentOf[tile] ? (photos[parentOf[tile]!] ?? null) : null;
  return [own, parent].filter((r): r is string => Boolean(r));
}
