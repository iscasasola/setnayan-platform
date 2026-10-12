'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '@/app/_components/sheet';

/**
 * 🎁 THE WISH LIST'S ONE SHEET, and the three class strings its sheets share —
 * lifted out of `studio-wish-list.tsx` (2026-10-08, wish list 5/5) so the gift
 * sheets in `studio-wish-gifts.tsx` open in the very same one, not a copy.
 *
 * The Schedule's sheet, portalled to <body> and lifted over the Maker's bars (as
 * Love Story's add sheet): a title, an optional pill beside it, then the body.
 */

export const FIELD =
  'mt-1.5 min-h-11 w-full scroll-mb-24 rounded-md border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink/40 focus:outline-none';
export const LABEL = 'flex items-center justify-between gap-2 text-[13px] text-ink/60';
export const FOOT = 'sn-glass-row sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 px-5 py-3';

export function WishSheet({ title, titleId, pill, onClose, children }: { title: string; titleId: string; pill?: ReactNode; onClose: () => void; children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-wish-sheet="" className="relative z-[90]">
      <Sheet open onClose={onClose} labelledById={titleId} wide rise>
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
            <h3 id={titleId} className="font-display text-[22px] leading-tight text-ink">
              {title}
            </h3>
            {pill}
          </div>
          {children}
        </div>
      </Sheet>
    </div>,
    document.body,
  );
}
