'use client';

import { useEffect, useRef } from 'react';
import { SwitcherPanelBody, type SheetPlace } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData, SwitcherShop } from '@/app/_components/account-switcher/get-switcher-data';
import { supplierAvatarRows } from '@/app/vendor-dashboard/_components/supplier-avatar-rows';
import type { SheetUnread } from '@/lib/avatar-sheet-counts';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';

const SETNAPROD: SwitcherShop = { id: 'S89V-LAB0000001', name: 'SetnaProd', logoUrl: null, publicHref: '/v/setnaprod', owned: true };
const BLOOM: SwitcherShop = { id: 'S89V-LAB0000002', name: 'Bloom & Vine Florals', logoUrl: null, publicHref: '/v/bloom-and-vine', owned: false };
const LENS: SwitcherShop = { id: 'S89V-LAB0000003', name: 'Lens Lab Studio', logoUrl: null, publicHref: null, owned: false };

function person(over: Partial<SwitcherData> & { shops?: SwitcherShop[]; isAdmin?: boolean; canOpenShop?: boolean }): SwitcherData {
  const shops = over.shops ?? [];
  return {
    userId: 'lab-user',
    displayName: over.displayName ?? 'Ice Casasola',
    email: over.email ?? 'iscasasolaii@gmail.com',
    isAnonymous: false,
    photoUrl: null,
    events: [],
    eventsMeasured: true,
    context: {
      hasVendor: shops.length > 0,
      vendorName: shops[0]?.name ?? null,
      isAdmin: over.isAdmin ?? false,
      canOpenShop: over.canOpenShop ?? false,
      shops,
    },
    otherAccounts: over.otherAccounts ?? [],
    canAddAccount: over.canAddAccount ?? true,
  };
}

const CLAIRE = { uid: '22222222-2222-4222-8222-222222222222', email: 'claire@example.com', name: 'Claire Casasola' };

const CASES: Record<
  string,
  { data: SwitcherData; here: SheetPlace; activeShopId?: string; unread: SheetUnread; refer: boolean; shopRows: boolean; title: string }
> = {
  owner: { title: 'Events', data: person({ shops: [SETNAPROD], isAdmin: true, otherAccounts: [CLAIRE] }), here: 'events', unread: { events: 2, shop: 3, admin: 7 }, refer: true, shopRows: false },
  supplier: { title: 'Today', data: person({ shops: [SETNAPROD], isAdmin: true, otherAccounts: [CLAIRE] }), here: 'shop', activeShopId: SETNAPROD.id, unread: { events: 2, shop: 3, admin: 7 }, refer: false, shopRows: true },
  // An OWNER of SetnaProd who also helps Bloom & Vine (owner 2026-10-22: every account switches between all of its
  // shops). `owner2` stands in their own shop; `owner2b` is the same person after pressing Bloom & Vine.
  owner2: { title: 'Today', data: person({ shops: [SETNAPROD, BLOOM] }), here: 'shop', activeShopId: SETNAPROD.id, unread: { events: 2, shop: null, admin: 0 }, refer: false, shopRows: true },
  owner2b: { title: 'Today', data: person({ shops: [SETNAPROD, BLOOM] }), here: 'shop', activeShopId: BLOOM.id, unread: { events: 2, shop: null, admin: 0 }, refer: false, shopRows: true },
  helper: { title: 'Today', data: person({ displayName: 'Pia Reyes', email: 'pia@example.com', shops: [BLOOM, LENS], canOpenShop: true }), here: 'shop', activeShopId: BLOOM.id, unread: { events: 1, shop: null, admin: 0 }, refer: false, shopRows: true },
  couple: { title: 'Events', data: person({ displayName: 'Claire Casasola', email: 'claire@example.com', canOpenShop: true, otherAccounts: [{ uid: '11111111-1111-4111-8111-111111111111', email: 'iscasasolaii@gmail.com', name: 'Ice Casasola' }] }), here: 'events', unread: { events: 4, shop: null, admin: 0 }, refer: true, shopRows: false },
};

export function SheetLab({ who, app, dark, noCount }: { who: string; app: boolean; dark: boolean; noCount: boolean }) {
  const c = CASES[who] ?? CASES.owner!;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: () => {}, containerRef: dialogRef });
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', dark);
    html.setAttribute('data-spotlight', '');
    return () => {
      html.classList.remove('dark');
      html.removeAttribute('data-spotlight');
    };
  }, [dark]);
  return (
    <main className="relative min-h-dvh bg-cream text-ink" data-avatar-sheet-lab={who}>
      <div className="flex h-14 items-center justify-between px-4">
        <span className="font-display text-xl tracking-[0.12em]">SETNAYAN</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">
          {(c.data.displayName ?? '?').charAt(0)}
        </span>
      </div>
      <h1 className="px-4 pt-4 font-display text-3xl">{c.title}</h1>
      <OverlayBackdrop onClose={() => {}} fade={false} className="z-[51]" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Account switcher"
        className="sn-sheet fixed inset-x-0 bottom-0 z-[52] flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border-t border-ink/10 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div aria-hidden className="mx-auto mb-1.5 mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--m-line)]" />
        <SwitcherPanelBody
          data={c.data}
          close={() => {}}
          referHref={c.refer ? '/dashboard/lab/refer' : null}
          shopRows={c.shopRows ? supplierAvatarRows({ storeShell: app }) : null}
          here={c.here}
          activeShopId={c.activeShopId ?? null}
          unread={noCount ? null : c.unread}
        />
      </div>
    </main>
  );
}
