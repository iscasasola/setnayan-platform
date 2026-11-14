'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useChromeAway } from '@/app/_components/nav/use-chrome-away';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { useModalA11y } from '@/lib/use-modal-a11y';

/**
 * 📅 CHECK A DATE, OVER THE SHOP (SHOP-02 v7, owner-approved 14 Nov 2026 — prototype "Check A Date Seats").
 *
 * Before, Check a date was a page of its own with no × and a "See the shop" button that opened the shop as a NEW page,
 * so Back then left the shop and the search was lost. Now it rises over the shop, the way a service card opens:
 *
 *   · phone — full screen; × top left lowers it. Reduced motion: it fades instead of rising.
 *   · computer — a tall panel in the middle over the dimmed shop, the width of an open service card. Clicking outside
 *     it or pressing Esc closes it.
 *   · × and Back do the same thing: the shop is still underneath, where you left it. Back again leaves the shop for
 *     wherever you came from, as it always did.
 *
 * The sheet is the shop page's `?dates` address, so the printed QR (`/v/<slug>/dates`, which now forwards here) opens
 * the shop with the sheet already up — × then shows the shop, never an empty screen.
 */

/** Set by the shop's own "Check a date" button: the sheet was opened FROM the shop, so × is a step back. */
export const DATES_FROM_SHOP_KEY = 'sn-dates-from-shop';

export function CheckADateSheet({ shopHref, children }: { shopHref: string; children: (close: () => void) => ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [up, setUp] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // The bars step away while the sheet is up — the way an open service card does — so the layer can sit just UNDER the
  // app's one bottom sheet (z-50), which a tapped day opens on top of it.
  useChromeAway(true);

  useEffect(() => {
    setMounted(true);
    const raf = requestAnimationFrame(() => setUp(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = useCallback(() => {
    let fromShop = false;
    try {
      fromShop = window.sessionStorage.getItem(DATES_FROM_SHOP_KEY) === window.location.pathname;
      window.sessionStorage.removeItem(DATES_FROM_SHOP_KEY);
    } catch {
      fromShop = false;
    }
    // Opened from the shop → one step back lands on the shop, scrolled where it was. Arrived cold (the QR, a shared
    // link) → there is no shop behind it in history, so the address is replaced by the shop's own.
    if (fromShop) router.back();
    else router.replace(shopHref, { scroll: false });
  }, [router, shopHref]);

  // Focus moves into the sheet and stays there; Esc closes it; the page underneath does not scroll.
  useModalA11y({ open: mounted, onClose: close, containerRef: panel });

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[49]" data-check-date-sheet="">
      {/* The one house scrim (computer only — on a phone the sheet covers the screen). */}
      <OverlayBackdrop onClose={close} className="hidden md:block" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Check a date"
        className={`absolute inset-0 overflow-y-auto bg-cream text-ink shadow-2xl transition-[transform,opacity] duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:transition-opacity md:inset-y-0 md:left-1/2 md:right-auto md:w-[min(576px,100%)] md:-translate-x-1/2 ${
          up ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 motion-reduce:translate-y-0'
        }`}
      >
        {children(close)}
      </div>
    </div>,
    document.body,
  );
}
