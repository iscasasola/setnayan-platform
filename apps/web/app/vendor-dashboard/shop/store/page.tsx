import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { loadStore } from './_components/store-data';
import { StoreFront } from './_components/store-screens';

export const metadata = { title: 'Toolkit · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 🛍 SHOP › STORE (owner 23 Nov 2026 — drawing `supplier_store_graphs_badges_2026-11-23` v10, F1): three shelves —
 * Specialized Tools · Graphs · Badges — each a sideways row with "See all N". Tools say Open · Get · their one-time
 * price (from the catalog); graphs are all free; badges are earned, never sold (Track). Search at the thumb.
 * One read (`loadStore`). 🔒 lib/supplier-store.test.ts · shop/store/the-store-is-the-drawing.test.ts
 */
export default async function ShopStorePage() {
  const d = await loadStore();
  return (
    <ToolPage name="store">
      <StoreFront d={d} />
    </ToolPage>
  );
}
