'use client';

/**
 * SupplierLabShell — the REAL One Shell around a supplier lab page, the way `app/vendor-dashboard/layout.tsx` draws
 * it, with no sign-in and no database. DEV-ONLY: mounted only by `/dev/supplier-lab` (`&shell=1`), which production
 * builds 404.
 *
 * Why it exists (supplier dashboard desktop, 2026-10-23 — prototype `desktop_layouts_2026-10-22.html` family 2, build
 * note 2: "the supplier labs get `&shell=1` … so the tablet band can be walked without a sign-in"). The supplier labs
 * drew their bodies with no rail, because the rail needs a sign-in. This draws the shipped `FrontDoorShell` in its app
 * variant with `boundary="tab"`, the shop's `focus` (one "My Home" row) and the real `VendorRailContext`, the layout's
 * own content wrappers (`.sn-ambient` · `<main className="sn-vt-page">` · the phone-bar clearance) and the real anchored
 * `BottomDock` + the shop's real tab list — the twin of `lab-shell.tsx` (the couple's). Only the account is a fixture.
 *
 * `measure` wraps the lab body in its PAGE's column (the labs draw the bodies bare): Today and Money read (48 rem),
 * People and Dates are the wide stage (64 rem) — the same class sets the pages carry. The lab's own cream wrapper is
 * neutralised inside the shell so the page sits on the layout's ground, as it does on the dashboard.
 */
import type { ReactNode } from 'react';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import { VendorRailContext } from '@/app/vendor-dashboard/_components/vendor-rail-context';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';

/** The pages' own outermost columns — `vendor-dashboard/page.tsx` (Today) and `customers/page.tsx`. */
const COLUMN = {
  today: 'mx-auto w-full max-w-6xl tab:max-w-3xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8',
  reading: 'mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 tab:max-w-3xl',
  wide: 'mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8 tab:max-w-5xl',
} as const;

export type SupplierLabMeasure = keyof typeof COLUMN | 'own';

export function SupplierLabShell({ measure, children }: { measure: SupplierLabMeasure; children: ReactNode }) {
  return (
    <div className="app-surface" data-lab-shell="supplier">
      <style>{`[data-lab-shell] [data-supplier-lab]{min-height:0;background:transparent;padding-left:0;padding-right:0}`}</style>
      <FrontDoorShell
        variant="app"
        boundary="tab"
        account={{ signedIn: true, initials: 'RM', shopName: 'Lumina Studio', isAdmin: false }}
        navLabels={{}}
        focus={{ href: '/dashboard', label: 'My Home', caption: 'Home' }}
        railContext={
          <VendorRailContext shopName="Lumina Studio" role="owner" navSlots={{}} bookingsBadge={2} threadsBadge={1} planHref={null} tier={null} />
        }
        topBarSlot={
          <div className="flex items-center gap-3" data-lab-cluster="">
            <span className="hidden text-sm text-ink/60 lg:inline">Lumina Studio</span>
            <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">RM</span>
          </div>
        }
      >
        <div className="sn-ambient min-h-screen">
          <main className="sn-vt-page">
            <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] tab:pb-0">
              {measure === 'own' ? children : <div className={COLUMN[measure]}>{children}</div>}
            </div>
          </main>
        </div>
      </FrontDoorShell>
      <BottomDock boundary="tab">
        <BottomNav items={vendorBarItems({ role: 'owner', navSlots: {}, bookingsBadge: 2, threadsBadge: 1 })} />
      </BottomDock>
    </div>
  );
}
