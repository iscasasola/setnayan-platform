import { renderVendorBySlug, vendorMetadataBySlug } from '../page';
import { wearShopPageTags } from '@/lib/shop-page-cache';

/**
 * /v/{slug} — A SHOP'S PUBLIC PAGE, SERVED FROM THE CACHE (speed, 2026-11-10 · `lib/shop-view.ts`).
 *
 * Never addressed directly: the middleware rewrites a stranger's `/v/{slug}` here (no session, no demo cookie, no
 * native-shell mark, no query the page reads — `shopRequestShape`) and refuses this path from outside. The page is the
 * live page's own function (`renderVendorBySlug`, `../page.tsx`), unchanged; what differs is that NOTHING below reads
 * the request — every reader asks `onTheCachedHub()` first (lib/hub-request.ts, `CACHED_SHOP_ROUTE`) and answers what
 * the live render would have read for a stranger — so Next renders each shop once and serves it from the cache until:
 *   · a save changes the shop (`revalidateShopPage` → the shop's tag, worn by the body once it knows the shop);
 *   · or the address starts or stops being a shop (the slug's tag, worn here — a 404 copy is cleared when it opens);
 *   · or `revalidate` seconds pass — the backstop for what no supplier save moves (a couple's review, a save count,
 *     a date booked through another door).
 * The view is counted by the page's beacon (`ShopViewBeacon`), not `after()`: a cached copy is rendered once, opened
 * many times.
 */

/** The backstop window — the cached Event Hub's own (owner-accepted for guests, EV1); tags are the freshness rule. */
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return vendorMetadataBySlug(slug);
}

export default async function CachedShopPage({ params }: Props) {
  const { slug } = await params;
  await wearShopPageTags({ slug });
  return renderVendorBySlug({ slug, searchParams: Promise.resolve({}), cachedCopy: true });
}
