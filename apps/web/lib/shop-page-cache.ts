import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { SHOP_PAGES_TAG, shopPageTag, shopSlugTag } from './shop-view';

/**
 * lib/shop-page-cache.ts — THE CACHED SHOP PAGE'S TWO HALVES ON THE SERVER (speed, 2026-11-10). See `lib/shop-view.ts`.
 *
 * · `wearShopPageTags` — called by the cached copy while it renders (`app/v/[slug]/cached/page.tsx` and the page body
 *   once it knows the shop), so the copy is filed under the shop's tag and its address's tag.
 * · `revalidateShopPage` — called by every save that changes what a shop's public page draws, so a stranger's next
 *   open is drawn fresh. Its own people never wait for it: a signed-in viewer always gets the live render.
 *
 * Best-effort on purpose: a save that already succeeded must never fail because the cache could not be told (a call
 * outside a request, a script). The copy's `revalidate` window is the backstop.
 */

/** Tell the cache this shop's public page changed. Pass the slug too when the save made or renamed the address. */
export function revalidateShopPage(vendorProfileId: string | null | undefined, slug?: string | null): void {
  try {
    if (vendorProfileId) revalidateTag(shopPageTag(vendorProfileId));
    if (slug) revalidateTag(shopSlugTag(slug));
  } catch {
    /* outside a request (a script, a test) — the copy's revalidate window still bounds how stale it can be */
  }
}

/**
 * Tell the cache EVERY shop's page changed — for a save that is no one shop's (the platform's own price list, which
 * every shop page prices its add-ons from). Rare by nature; never call it for one shop's save.
 */
export function revalidateAllShopPages(): void {
  try {
    revalidateTag(SHOP_PAGES_TAG);
  } catch {
    /* outside a request — the revalidate window bounds it */
  }
}

/** File the copy being rendered under these tags (the EV1 hub's `wearTheEventsTag` shape). */
export async function wearShopPageTags(tags: { vendorProfileId?: string | null; slug?: string | null }): Promise<void> {
  const list = [
    ...(tags.slug ? [SHOP_PAGES_TAG] : []),
    ...(tags.vendorProfileId ? [shopPageTag(tags.vendorProfileId)] : []),
    ...(tags.slug ? [shopSlugTag(tags.slug)] : []),
  ];
  if (list.length === 0) return;
  await unstable_cache(async () => true, ['shop-page-tag', ...list], { tags: list })();
}
