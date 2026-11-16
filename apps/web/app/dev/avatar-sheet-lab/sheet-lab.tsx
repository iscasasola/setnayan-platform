'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { sheetBackLabel } from '@/lib/sheet-back-label';
import { SwitcherPanelBody, type SheetPlace } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData, SwitcherShop } from '@/app/_components/account-switcher/get-switcher-data';
import { supplierAvatarRows } from '@/app/vendor-dashboard/_components/supplier-avatar-rows';
import type { SheetUnread } from '@/lib/avatar-sheet-counts';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';

const SETNAPROD: SwitcherShop = { id: 'S89V-LAB0000001', name: 'SetnaProd', logoUrl: null, publicHref: '/setnaprod', owned: true };
const BLOOM: SwitcherShop = { id: 'S89V-LAB0000002', name: 'Bloom & Vine Florals', logoUrl: null, publicHref: '/bloom-and-vine', owned: false };
const LENS: SwitcherShop = { id: 'S89V-LAB0000003', name: 'Lens Lab Studio', logoUrl: null, publicHref: null, owned: false };

function person(over: Partial<SwitcherData> & { shops?: SwitcherShop[]; isAdmin?: boolean; canOpenShop?: boolean }): SwitcherData {
  const shops = over.shops ?? [];
  return {
    userId: 'lab-user',
    displayName: over.displayName ?? 'Ice Casasola',
    email: over.email ?? 'iscasasolaii@gmail.com',
    isAnonymous: false,
    photoUrl: over.photoUrl ?? null,
    photoFrame: over.photoFrame ?? null,
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
  // 🖼 A profile photo with its frame set (owner 2026-11-06: "yes, use the same control"; 7 Nov drag + pinch) —
  // up and a little left, 1.5×. The fixture portrait is the You lab's (`/portraits/isabel-santos.avif`).
  framed: { title: 'Events', data: person({ displayName: 'Isabel Santos', email: 'isabel@example.com', photoUrl: '/portraits/isabel-santos.avif', photoFrame: { x: 35, y: 20, zoom: 150 } }), here: 'events', unread: { events: 1, shop: null, admin: 0 }, refer: true, shopRows: false },
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
        /* The SHIPPED panel box, class for class (`renderPanel()` in account-switcher.tsx): full screen on a phone, a 360-px
           card under the pill from `lg` (16 Nov 2026). It copied only the phone half until 2026-11-01, so at 1280 the lab — and only
           the lab — drew a phone sheet across a desktop. `the-lab-sheet-is-the-shipped-panel.test.ts` holds the copy. */
        className={[
          'focus:outline-none',
          'fixed inset-0 z-[52] flex pl-[var(--sn-safe-l)] pr-[var(--sn-safe-r)] pt-[env(safe-area-inset-top)] flex-col overflow-hidden sn-sheet pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl',
          'lg:inset-x-auto lg:bottom-auto lg:right-[max(0.75rem,var(--sn-safe-r))] lg:pl-0 lg:pr-0 lg:pt-0 lg:top-[calc(var(--fd-bar,56px)_+_8px)] lg:w-[360px] lg:max-h-[calc(100dvh_-_var(--fd-bar,56px)_-_16px)] lg:rounded-2xl lg:border lg:border-ink/10 lg:pb-0',
        ].join(' ')}
      >
        {/* The phone's full-screen head (16 Nov 2026) — the lab's back and ✕ do nothing. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-2 lg:hidden" data-account-sheet-head="">
          <span data-account-sheet-back="" className="inline-flex min-h-[44px] min-w-0 items-center gap-1 rounded-full px-2 text-[15px] font-medium text-ink">
            <ChevronLeft aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2} />
            {/* The label comes from the shipped `sheetBackLabel`, fed this lab page's own title — never typed here. */}
            <span className="min-w-0 [overflow-wrap:anywhere]">{sheetBackLabel({ pathname: '/dev/avatar-sheet-lab', title: c.title })}</span>
          </span>
          <span aria-label="Close" data-account-sheet-close="" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink">
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </span>
        </div>
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
