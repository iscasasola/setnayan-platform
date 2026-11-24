import { notFound } from 'next/navigation';
import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { SHELF_TITLE, isStoreShelf } from '@/lib/supplier-store';
import { loadStore } from '../_components/store-data';
import { StoreShelfScreen } from '../_components/store-screens';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  return { title: `${isStoreShelf(shelf) ? SHELF_TITLE[shelf] : 'Toolkit'} · Toolkit · Supplier` };
}

/**
 * 🛍 ONE TOOLKIT SHELF (drawing v19). A Shop [+] tile lands here. `tools` = every widget; `chat` · `present` · `hub` ·
 * `shop_page` = a widget shelf (its widgets as a list); `qr` = the QR designs; `yours` = the Your widgets manager
 * (place chips, Open · How to use it · Remove). The three Forms shelves have no item yet, so they have no page.
 *   Tools  — tag chips, then "For you", "Yours" (✓ Installed) and "More tools" (Install · Buy ₱ the one-time price · Price not
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
