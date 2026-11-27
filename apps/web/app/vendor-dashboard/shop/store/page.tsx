import { loadStore } from './_components/store-data';
import { StoreFront } from './_components/store-screens';

export const metadata = { title: 'Toolkit · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 🛍 SHOP › STORE (owner 23 Nov 2026 — drawing `supplier_store_graphs_badges_2026-11-23` v10, F1): three shelves —
 * Specialized Tools · Graphs · Badges — each a sideways row with "See all N". Tools say ✓ Installed · Install · Buy with their one-time
 * price (from the catalog); graphs are all free; badges are earned, never sold (Track). Search at the thumb.
 * One read (`loadStore`). 🔒 lib/supplier-store.test.ts · shop/store/the-store-is-the-drawing.test.ts
 */
export default async function ShopStorePage() {
  const d = await loadStore();
  return (
    // The Toolkit front takes the body's width (final check B12): its "Included" shelves sit side by side from the
    // tablet line, so the reading column's cap would leave a wide empty gutter and cut the pinned title row short.
    <div className="mx-auto w-full px-4 pb-16 sm:px-6" data-tool-page="store" data-store-front="">
      <StoreFront d={d} />
    </div>
  );
}
