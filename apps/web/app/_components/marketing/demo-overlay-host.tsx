'use client';

/**
 * demo-overlay-host.tsx — the overlay mount for the public product doorways.
 *
 * The doorways stopped being `NAV_ROUTES` on 2026-08-15 (they wear the shared
 * shell now, not the marketing glass nav), and `SiteChrome` — which mounted
 * `HomeOverlays` for them — self-gates to that set. So the demo overlays lost
 * their host at the same moment the pages gained the rail.
 *
 * 🔑 WITHOUT THIS, THE "Try the demo" BUTTON ON EVERY DOORWAY BECOMES A FAKE
 * DOOR. `openDemoOverlay` returns false when nobody is listening — a SILENT
 * failure, the shape this repo keeps paying for. That is not hypothetical: the
 * demos spent two days unreachable because a deleted homepage took their only
 * openers with it.
 *
 * ⚠ PRICING IS NULL AND THAT IS CORRECT. `HomeOverlays` internally gates its
 * pricing-dependent overlays (prices · vendors · setnayan-ai) on a non-null
 * `pricing`, and this host only ever opens the three DEMO overlays, none of
 * which read it. Fetching the pricing payload on a product page to satisfy a
 * prop nothing on this path uses would be a round trip for no rendered pixel.
 *
 * `ssr: false` + `next/dynamic` mirrors `site-chrome.tsx` — nothing is fetched
 * until a demo is actually opened.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { subscribeDemoOverlay } from '@/lib/demo-overlay-bus';
import type { OverlayId } from '@/app/_components/home/HomeOverlays';

const HomeOverlays = dynamic(
  () => import('@/app/_components/home/HomeOverlays').then((m) => m.HomeOverlays),
  { ssr: false },
);

export function DemoOverlayHost() {
  const [overlay, setOverlay] = useState<OverlayId>(null);

  useEffect(() => subscribeDemoOverlay(setOverlay), []);

  if (!overlay) return null;

  return (
    <HomeOverlays current={overlay} onClose={() => setOverlay(null)} pricing={null} />
  );
}
