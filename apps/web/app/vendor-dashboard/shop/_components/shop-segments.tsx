'use client';

import { useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePinFold } from '@/app/_components/pinned-row/use-pin-fold';
import { PinFigures } from '../../_components/pin-figures';
import type { PinFigure } from '@/lib/pin-figure';
import { SHOP_SEGMENT_HINT, SHOP_SEGMENT_HREF, SHOP_SEGMENT_LABEL, SHOP_SEGMENT_ORDER, type ShopSegment } from './shop-sections';

export { SHOP_SEGMENT_HINT, SHOP_SEGMENT_HREF, SHOP_SEGMENT_LABEL, SHOP_SEGMENT_ORDER, type ShopSegment };

/**
 * SHOP ▾ — Details · Services · Page · Gallery · Analytics, drawn as Shop's ONE PINNED ROW — `Shop · Details ▾` on the
 * phone too (the ONE SELECTOR, owner 2026-10-30 "all yes": "Page · View ▾"), its figures the one shared door (supplier dashboard v13,
 * APPROVED 2026-10-29 "Approved."). The list itself is `shop-sections.ts` (a plain module, so a server page and the
 * guards can read it without a client boundary); this is where a supplier picks one.
 *
 * ⏮ WAS three pills — Services · Page · How it is going — with Details and Collections lighting Page (step 5,
 * 2026-10-14). v13 gives Details and Gallery their own place in the menu and calls the third one Analytics.
 *
 * 📌 THE PINNED ROW (S5; owner 2026-10-29 "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON
 * SCROLL"): the section ▾ on the left, the section's own three figures beside it (`PinFigures`, the S4 Dates · Money
 * tile — #7066 — the same doors Customers' row draws), folded into one slim line by the shared `usePinFold` once the page
 * runs under it. From 701 the bar's menu IS the picker, so the ▾ steps aside (`data-shop-segmented`,
 * `supplier-frame.css`) and the figures keep the row. Any set of choices is ONE dropdown (house rule) — five pills do
 * not fit a 390-px phone.
 *
 * 🔒 shop/the-shop-sections-are-v13.test.ts · _components/how-it-is-going-is-a-shop-segment.test.ts
 */
export function ShopSegments({
  on,
  figures = null,
  end = null,
}: {
  on: ShopSegment;
  /** The section's own figures on this row (honest: an unread one is "—", never 0). */
  figures?: readonly PinFigure[] | null;
  /** The row's right end (a section's own round), when it has one. */
  end?: ReactNode;
}) {
  const router = useRouter();
  const pinRef = useRef<HTMLDivElement>(null);
  usePinFold(pinRef);
  return (
    <div
      ref={pinRef}
      className="sticky top-0 z-[5] -mx-4 border-b border-ink/10 px-4 py-1.5 sm:-mx-6 sm:px-6"
      style={{ background: 'var(--sn-canvas)' }}
      data-shop-pin={on}
      data-pin-fold=""
      data-pinned-row=""
      data-first-row=""
    >
      <div className="flex min-h-11 items-center gap-1" role="group" aria-label="Shop">
        <span className="shrink-0" data-shop-segmented="" data-tour="shop-segments">
          <PickMenu
            label="Shop — show"
            value={on}
            buttonText={`Shop · ${SHOP_SEGMENT_LABEL[on]}`}
            options={SHOP_SEGMENT_ORDER.map((s) => ({ key: s, label: SHOP_SEGMENT_LABEL[s], hint: SHOP_SEGMENT_HINT[s] }))}
            compact
            dataAttr="data-shop-seg-pick"
            onPick={(k) => {
              if (k !== on) router.push(SHOP_SEGMENT_HREF[k as ShopSegment], { scroll: false });
            }}
          />
        </span>
        {figures && figures.length ? (
          <PinFigures figures={figures} label={`Shop · ${SHOP_SEGMENT_LABEL[on]}`} name="shop" />
        ) : (
          <span className="flex-1" aria-hidden />
        )}
        {end}
      </div>
    </div>
  );
}
