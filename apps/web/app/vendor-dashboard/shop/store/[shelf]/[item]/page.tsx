import { notFound, redirect } from 'next/navigation';
import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { routes } from '@/lib/routes';
import { STORE_GRAPHS, isGraphKey, isStoreShelf, qrWords, storeToolOf } from '@/lib/supplier-store';
import { isPromoteQrMode, type SupplierQrMode } from '@/lib/supplier-qr-codes';
import { avTemplateOf, payTemplateOf } from '@/lib/toolkit-templates';
import { loadStore } from '../../_components/store-data';
import { StoreItemScreen } from '../../_components/store-screens';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  const key = decodeURIComponent(item);
  const title =
    shelf === 'tools'
      ? storeToolOf(key)?.title
      : shelf === 'graphs' && isGraphKey(key)
        ? STORE_GRAPHS[key].title
        : shelf === 'qr' && isPromoteQrMode(key as SupplierQrMode)
          ? qrWords(key as never).name
          : shelf === 'payment_plans'
            ? payTemplateOf(key)?.name
            : shelf === 'availability'
              ? avTemplateOf(key)?.name
              : null;
  return { title: `${title ?? 'Toolkit'} · Toolkit · Supplier` };
}

/**
 * 🛍 ONE STORE ITEM (drawing v10 — F3 Cake Maker · F7 a graph). A tool: what it is, its price (one-time, yours forever —
 * from the catalog row, never typed) or its state (Owned · With your plan · Free), what it adds to the shop, and ONE button: Buy · ₱… / Get / Open. A graph: what it shows, Good to
 * know (Free · Window · Counts), and Install. A QR design (Toolkit v19): what it opens, Install / Remove, and Where it
 * works (Promote). A template (payment plan · availability): what is inside, Install / Remove, the plan editor once
 * installed, Where it works. A badge has no item of its own: it opens on the Badges page. Every other shelf has none.
 */
export default async function StoreItemPage({ params }: { params: Promise<{ shelf: string; item: string }> }) {
  const { shelf, item } = await params;
  if (!isStoreShelf(shelf)) notFound();
  const key = decodeURIComponent(item);
  if (shelf === 'badges') redirect(`${routes.vendorDashboard.shop.badges()}#${encodeURIComponent(key)}`);
  if (shelf !== 'tools' && shelf !== 'graphs' && shelf !== 'qr' && shelf !== 'payment_plans' && shelf !== 'availability') notFound();
  // 🧩 A template (Toolkit templates, specs 24dcf90c): one of the shelf's own, or no page.
  if (shelf === 'payment_plans' && !payTemplateOf(key)) notFound();
  if (shelf === 'availability' && !avTemplateOf(key)) notFound();
  const tool = shelf === 'tools' ? storeToolOf(key) : null;
  if (shelf === 'tools' && !tool) notFound();
  if (shelf === 'graphs' && !isGraphKey(key)) notFound();
  if (shelf === 'qr' && !isPromoteQrMode(key as SupplierQrMode)) notFound();
  const d = await loadStore();
  // 📷 A gated widget (the Papic camera) is not in the Toolkit while its switch is off — its page is not either.
  if (tool?.gate === 'papic_capture' && d.tools.papicCapture !== true) notFound();
  return (
    <ToolPage name={`store-item-${shelf}`}>
      <StoreItemScreen shelf={shelf} itemKey={key} d={d} />
    </ToolPage>
  );
}
