import { notFound } from 'next/navigation';
import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { SHELF_TITLE, isStoreShelf } from '@/lib/supplier-store';
import { loadStore } from '../_components/store-data';
import { StoreShelfScreen } from '../_components/store-screens';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  return { title: `${isStoreShelf(shelf) ? SHELF_TITLE[shelf] : 'Store'} · Store · Supplier` };
}

/**
 * 🛍 ONE STORE SHELF (drawing v12 — Specialized Tools · Graphs · Badges). A Shop [+] tile lands here.
 *   Tools  — tag chips, then "For you", "Yours" (Open) and "More tools" (Get · the one-time price · Free trial · Price not
 *            set yet), each tool with the supplier types it is for.
 *   Graphs — "On your Analytics" (✓ On your page; the order lives on the Shop’s Edit), then the groups with Get, or the badge that opens it.
 *   Badges — "On your Shop" (the ones chosen, any number; never chosen = the three closest), "More badges" with Add,
 *            and Setnayan Verified (✓ Earned, never added).
 */
export default async function StoreShelfPage({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  if (!isStoreShelf(shelf)) notFound();
  const d = await loadStore();
  return (
    <ToolPage name={`store-${shelf}`}>
      <StoreShelfScreen shelf={shelf} d={d} />
    </ToolPage>
  );
}
