'use client';

import { useRef } from 'react';
import { SwitcherPanelBody } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { supplierAvatarRows } from '@/app/vendor-dashboard/_components/supplier-avatar-rows';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';

const SHOP = { id: 'S89V-LAB0000001', name: 'SetnaProd', logoUrl: null, publicHref: '/v/setnaprod', owned: true };
const DATA: SwitcherData = {
  userId: 'lab-user',
  displayName: 'Lab Supplier',
  email: 'lab@example.com',
  isAnonymous: false,
  photoUrl: null,
  photoFrame: null,
  events: [],
  eventsMeasured: true,
  context: { hasVendor: true, vendorName: SHOP.name, isAdmin: false, canOpenShop: false, shops: [SHOP] },
  otherAccounts: [],
  canAddAccount: false,
};

/** The avatar sheet as the supplier layout draws it (open), its rows pointed at this lab's row pages. */
export function RiseRouteLabSheet() {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: () => {}, containerRef: ref });
  const rows = supplierAvatarRows().map((r) => ({ ...r, href: `/dev/rise-route-lab/${r.key}` }));
  return (
    <main className="relative min-h-dvh bg-cream text-ink" data-rise-route-lab="">
      <h1 className="px-4 pt-6 font-display text-3xl">Today</h1>
      <div data-account-sheet-layer="">
        <OverlayBackdrop onClose={() => {}} fade={false} className="z-[51]" />
        <div
          ref={ref}
          role="dialog"
          aria-label="Account switcher"
          className="fixed inset-x-0 bottom-0 z-[52] flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border-t border-ink/10 sn-sheet pb-4 shadow-2xl"
        >
          <SwitcherPanelBody data={DATA} close={() => {}} shopRows={rows} here="shop" activeShopId={SHOP.id} unread={null} />
        </div>
      </div>
    </main>
  );
}
