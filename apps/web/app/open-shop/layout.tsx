import type { ReactNode } from 'react';
import { OpenShopLayer } from './_components/open-shop-layer';
import '@/app/vendor-dashboard/_components/supplier-look.css';

/**
 * /open-shop · /open-shop/logo · /open-shop/invite — the steps of ONE layer (final check B1–B3, drawing
 * `final-check-area-5_2026-11-25.html` § B1–B3). The layer is mounted here, once, so it stays up while the steps
 * change under it. 🔒 app/open-shop/one-layer.test.ts
 */
export default function OpenShopLayout({ children }: { children: ReactNode }) {
  return <OpenShopLayer>{children}</OpenShopLayer>;
}
