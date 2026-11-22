import { notFound, redirect } from 'next/navigation';
import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { routes } from '@/lib/routes';
import { STORE_GRAPHS, isGraphKey, isStoreShelf, storeToolOf } from '@/lib/supplier-store';
import { loadStore } from '../../_components/store-data';
import { StoreItemScreen } from '../../_components/store-screens';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  const key = decodeURIComponent(item);
  const title = shelf === 'tools' ? storeToolOf(key)?.title : shelf === 'graphs' && isGraphKey(key) ? STORE_GRAPHS[key].title : null;
  return { title: `${title ?? 'Store'} · Store · Supplier` };
}

/**
 * 🛍 ONE STORE ITEM (drawing v10 — F3 Cake Maker · F7 a graph). A tool: what it is, its price (one-time, yours forever —
 * from the catalog row, never typed) or its state (Owned · With your plan · Free trial · Free), "Try it first" where a demo
 * exists, what it adds to the shop, and ONE button: Buy · ₱… / Get / Open. A graph: what it shows, an example, Good to
 * know (Free · Window · Counts), and Get · Free. A badge has no item of its own: it opens on the Badges page.
 */
export default async function StoreItemPage({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  if (!isStoreShelf(shelf)) notFound();
  const key = decodeURIComponent(item);
  if (shelf === 'badges') redirect(`${routes.vendorDashboard.shop.badges()}#${encodeURIComponent(key)}`);
  if (shelf === 'tools' && !storeToolOf(key)) notFound();
  if (shelf === 'graphs' && !isGraphKey(key)) notFound();
  const d = await loadStore();
  return (
    <ToolPage name={`store-item-${shelf}`}>
      <StoreItemScreen shelf={shelf} itemKey={key} d={d} />
    </ToolPage>
  );
}
