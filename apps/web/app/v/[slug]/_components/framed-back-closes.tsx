'use client';

import type { ReactNode } from 'react';
import { VIEW_SHOP_CLOSE, viewShopFrame } from '@/lib/view-shop-frame';

/**
 * ↩ Inside the Shop tab's View shop frame, the shop page's Back closes the frame instead of navigating — the supplier is
 * back on Shop, as they left it. Anywhere else it does nothing and the wrapped Back works as it always has.
 * Captured on the way DOWN, before `ReturnInPlace` and the link, and stopped there, so neither navigates.
 * 🔒 lib/back-from-view-shop-returns-to-shop.test.ts
 */
export function FramedBackCloses({ children }: { children: ReactNode }) {
  return (
    <span
      className="contents"
      onClickCapture={(e) => {
        const frame = viewShopFrame(window);
        if (!frame) return;
        e.preventDefault();
        e.stopPropagation();
        frame.dispatchEvent(new Event(VIEW_SHOP_CLOSE));
      }}
    >
      {children}
    </span>
  );
}
