'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { SHOP_GEAR_SECTIONS } from './shop-gear-sections';

/**
 * ⚙ SHOP SETTINGS (owner 2026-10-31, verbatim *"Yes follow your recommendation"* — DECISION_LOG "SHOP ⚙ — WHAT A
 * SUPPLIER SETS ONCE"). The house ⚙ (`MenuSettingsButton`, menu `shop`), mounted ONCE here, at the right end of Shop's
 * pinned row on every Shop section (`ShopSegments` draws it). What a supplier sets once and rarely touches: Plan and
 * billing · Team · Verification and documents · Notifications (· Shop status — see the body). The Home rule: the ⚙ is
 * for rare, account-level things; the page is for the work.
 *
 * 🔑 THE SHEET IS READ ONLY WHEN IT IS OPEN (the Customers ⚙'s pattern, `customers-settings.tsx`): its rows are the
 * SHIPPED editors (the Plan screen, the Helpers screen, the documents, the push switch) and they need reads no Shop
 * section makes. The ⚙ writes `?gear=1` into the address (no scroll); the server draws the rows for that address. A save
 * inside comes back to the same address (`lib/gear-return.server.ts`), sheet open on its fold (`gsec`).
 *
 * 🔗 EVERY OLD LINK STILL LANDS: `/vendor-dashboard/profile#docs` (Get verified, the Hub, the Plan picker, `/verify`)
 * named the Your-documents fold that lived on Shop › Details. That fold lives HERE now — an address that names one of
 * the ⚙'s folds (`#plan` · `#team` · `#docs` · `#notifications`) opens the sheet on it.
 */
export function ShopSettings({ body }: { body: ReactNode | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inUrl = params.get('gear') === '1';
  const section = params.get('gsec');
  const [open, setOpen] = useState(inUrl);
  useEffect(() => setOpen(inUrl), [inUrl]);

  const go = (next: boolean, fold?: string) => {
    setOpen(next);
    const q = new URLSearchParams(params.toString());
    for (const k of ['gsec', 'saved', 'invited', 'error', 'motion', 'voted', 'wallet']) q.delete(k);
    if (next) q.set('gear', '1');
    else q.delete('gear');
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}${next && fold ? `#${fold}` : ''}`, { scroll: false });
  };

  // An old link names a fold that moved in here (`#docs`) — on arrival, or from this same page (a figure, Get verified):
  // open the sheet on it.
  useEffect(() => {
    const check = () => {
      const at = window.location.hash.slice(1);
      if (new URLSearchParams(window.location.search).get('gear') !== '1' && (SHOP_GEAR_SECTIONS as readonly string[]).includes(at)) go(true, at);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // A save came back (`gsec`): the fold it was saved in opens again (the shared Fold opens on its `#anchor`).
  useEffect(() => {
    if (open && section && (SHOP_GEAR_SECTIONS as readonly string[]).includes(section) && window.location.hash !== `#${section}`) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${section}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [open, section, body]);

  return (
    <MenuSettingsButton menu="shop" open={open} onOpenChange={(next) => go(next)}>
      <div className="px-4 pb-6 pt-2" data-shop-settings="">
        {body ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/60" data-shop-settings-loading="">
            Opening your settings…
          </p>
        )}
      </div>
    </MenuSettingsButton>
  );
}
