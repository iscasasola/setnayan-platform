import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { ToolFail, ToolPage, ToolPin } from '@/app/vendor-dashboard/_components/tool-page';
import { routes } from '@/lib/routes';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import { followedBadges, graphStatus, storeToolRows, SHELF_TITLE } from '@/lib/supplier-store';
import { loadStore } from './_components/store-data';
import { StoreBadgeTile, StoreGraphTile, StoreShelfRow, StoreToolTile } from './_components/store-views';
import { StoreThumb } from './_components/store-client';

export const metadata = { title: 'Store · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 🛍 SHOP › STORE (owner 23 Nov 2026 — drawing `supplier_store_graphs_badges_2026-11-23` v10, F1): three shelves —
 * Specialized Tools · Graphs · Badges — each a sideways row with "See all N". Tools say Open · Get · their one-time
 * price (from the catalog) · Free trial; graphs are all free; badges are earned, never sold (Track). Search at the thumb.
 * One read (`loadStore`). 🔒 lib/supplier-store.test.ts · shop/store/the-store-is-the-drawing.test.ts
 */
export default async function ShopStorePage() {
  const d = await loadStore();
  const tools = storeToolRows(d.tools);
  const yours = d.badges ? followedBadges(d.picks?.badges ?? null, d.badges).keys : [];
  const graphs = [...d.on, ...CARD_ORDER.filter((k) => !d.on.includes(k))];
  return (
    <ToolPage name="store">
      <ToolPin route="/vendor-dashboard/shop/store" title="Store" sub={<span data-store-sub="">Tools, graphs and badges for your shop.</span>} />
      {d.picks === null ? <ToolFail title="Couldn’t load your picks" line="What is yours may show as not yet. Nothing was changed." retryHref={routes.vendorDashboard.shop.store.index()} /> : null}

      <StoreShelfRow title={SHELF_TITLE.tools} count={SPECIALIZED_TOOLS.length} href={routes.vendorDashboard.shop.store.shelf('tools')} data="tools">
        {tools.map((r) => (
          <StoreToolTile key={r.tool.key} row={r} />
        ))}
      </StoreShelfRow>

      <StoreShelfRow title={SHELF_TITLE.graphs} count={CARD_ORDER.length} href={routes.vendorDashboard.shop.store.shelf('graphs')} data="graphs">
        {graphs.map((k) => (
          <StoreGraphTile key={k} k={k} status={graphStatus(k, d.on, d.unlocks, d.badges)} />
        ))}
      </StoreShelfRow>

      {d.badges ? (
        <StoreShelfRow title={SHELF_TITLE.badges} count={d.badges.length} href={routes.vendorDashboard.shop.store.shelf('badges')} data="badges">
          {d.badges.map((t) => (
            <StoreBadgeTile key={t.key} tile={t} following={t.key !== 'verified' && yours.includes(t.key)} />
          ))}
        </StoreShelfRow>
      ) : (
        <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.index()} data="store-badges" />
      )}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing in the Store matches that.
      </p>
      <StoreThumb name="front" placeholder="Search the Store" />
    </ToolPage>
  );
}
