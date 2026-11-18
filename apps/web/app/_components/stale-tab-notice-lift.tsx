'use client';

/**
 * stale-tab-notice-lift.tsx — "Setnayan was updated" while a layer covers the page (walk RW-7853-a, 16 Nov 2026).
 *
 * `StaleTabNotice` draws its notice in the page flow. While a Sheet, a RiseScreen, a blocker or the phone's
 * full-screen chat thread covers the page (`aLayerCoversThePage`, `lib/build-version.ts`), the flow is underneath —
 * so for that time it hands the SAME notice here, and this draws it on <body> in the peek toast's place: the app's top
 * notification layer (`PEEK_TOAST_PLACE`, z 100), above every sheet and rise. No layer of its own; nothing is
 * duplicated — the notice is drawn here OR in the flow, never both.
 *
 * 🧭 Owner rulings 9 + 10 (17 Nov 2026): over the phone's chat thread it stands BELOW the thread's head (`top`, measured
 * from the head band) — never over the ‹ back or the name; over the guest send-run screen, which stands above the toast
 * layer (z 110), it is drawn INSIDE that screen (`host`), so it is on top of it. Over a Sheet or a RiseScreen it keeps
 * the peek toast's own place (ruling 8, as built).
 *
 * Loaded lazily by `StaleTabNotice`: the root layout's client tree is the SHARED chunk (202.3 KB budget), and this is
 * needed only by a stale tab holding typing with a sheet open.
 */

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PEEK_TOAST_PLACE } from './toast/peek-toast';
import { useHydrated } from '@/lib/use-hydrated';

export default function StaleTabNoticeLift({
  children,
  host = null,
  top = null,
}: {
  children: ReactNode;
  /** The layer to draw inside (the guest send-run screen); null = <body>. */
  host?: Element | null;
  /** Px from the top of the screen (just under a chat thread's head); null = the peek toast's own top. */
  top?: number | null;
}) {
  // <body> exists only after hydration; the house gate, so the hydration pass draws what the server drew (nothing).
  if (!useHydrated()) return null;
  return createPortal(
    <div data-app-chrome="" data-stale-tab-lift="" className={PEEK_TOAST_PLACE} style={top === null ? undefined : { top }}>
      {/* The live notice's tint is see-through (it was drawn for the page's ground); over a sheet it needs a ground of
          its own, or the sheet's head reads through it. The page's cream, and the peek toast's lift. */}
      <div className="pointer-events-auto w-full max-w-[640px] rounded-md bg-cream shadow-[0_14px_30px_-12px_rgba(0,0,0,.5)]">
        {children}
      </div>
    </div>,
    host ?? document.body,
  );
}
