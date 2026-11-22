/**
 * shop-cover-photo.ts — WHICH PHOTO LEADS A SHOP: the one rule the shop page's hero (`app/v/[slug]/page.tsx`) and the
 * shop's share card (`lib/social/vendor-card-facts.server.ts`) both follow, so the card always wears "the same photo as
 * their shop page" (drawing `shop_share_card_v2_fable.html`, step 1).
 *
 *   1. the shop's chosen hero photo — when its plan's picks render (`proPicksRender`) and the photo is not unlisted
 *      (an overdue top-up's event photos are off the page, `readPageRefsFromEvents`);
 *   2. else, when the shop shows its portfolio, the first portfolio photo that resolves (the first 12, unlisted ones
 *      left out — the page's own gallery read);
 *   3. else none — the page draws its placeholder, the card its dark Setnayan ground. Never a stock photo.
 *
 * Pure (keys only): resolving a key to a URL is each caller's own read. 🔒 lib/shop-cover-photo.test.ts
 */

/** How many portfolio photos the page reads (and so the most the cover can be chosen from). */
export const SHOP_PORTFOLIO_READ = 12;

/** The portfolio keys the page shows, in order: unlisted ones left out, the first `SHOP_PORTFOLIO_READ`. */
export function shopPortfolioKeys(keys: readonly string[] | null | undefined, unlisted: ReadonlySet<string>): string[] {
  return (keys ?? []).filter((k) => !unlisted.has(k)).slice(0, SHOP_PORTFOLIO_READ);
}

export type ShopCoverChoice = {
  /** The chosen hero photo's key, when it leads; null otherwise. */
  heroKey: string | null;
  /** When no hero leads (or it does not resolve): may the first portfolio photo lead? */
  portfolioLeads: boolean;
};

export function shopCoverChoice(i: {
  heroPhotoKey: string | null | undefined;
  proPicksRender: boolean;
  showPortfolio: boolean;
  unlisted: ReadonlySet<string>;
}): ShopCoverChoice {
  const hero = i.proPicksRender && i.heroPhotoKey && !i.unlisted.has(i.heroPhotoKey) ? i.heroPhotoKey : null;
  return { heroKey: hero, portfolioLeads: i.showPortfolio };
}
