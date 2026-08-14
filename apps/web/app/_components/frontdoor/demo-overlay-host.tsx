'use client';

/**
 * demo-overlay-host.tsx — the front door's own overlay mount.
 *
 * ─── WHY THE FRONT DOOR NEEDS ONE AT ALL ─────────────────────────────────
 * The demo overlays are rendered by `HomeOverlays`, which is mounted by
 * `SiteChrome` — and `SiteChrome` self-gates to `NAV_ROUTES`, from which `/` is
 * **deliberately omitted**. So the front page mounts NO overlays whatsoever.
 *
 * Without this component, the rail's Studio rows would offer a demo on the one
 * page every stranger lands on and open nothing at all: a fake door, on the
 * surface that forbids them most loudly. `openDemoOverlay` returns false when
 * no host is listening, which is a silent failure — exactly the "absence is the
 * only symptom" shape this repo keeps paying for. So the front door mounts its
 * own host and the rail only offers demos when it is there.
 *
 * ─── WHY NOT JUST ADD '/' TO NAV_ROUTES ──────────────────────────────────
 * 🚨 BECAUSE THAT MOUNTS A SECOND TOP BAR. `SiteChrome` renders the marketing
 * glass `<Nav>` alongside the overlays, and the front door already ships its own
 * bar — on the very branch whose whole purpose is that every surface has exactly
 * ONE. `one-top-bar.test.ts` would fail, and correctly.
 *
 * ⚠ The NAV_ROUTES comment justifies excluding `/` by saying the homepage
 * "renders its OWN nav instance (HomeReskin)" — a component DELETED on
 * 2026-08-13. The exclusion is still right; its stated reason is stale.
 *
 * ─── COST ────────────────────────────────────────────────────────────────
 * `HomeOverlays` is `dynamic(ssr: false)`, so nothing is fetched until a demo
 * is actually opened. This adds a listener and an empty render to `/`.
 *
 * ⚠ PRICING IS NULL AND THAT IS CORRECT HERE. `HomeOverlays` internally gates
 * its pricing-dependent overlays (prices · vendors · setnayan-ai) on a non-null
 * `pricing`, and this host only ever opens the three DEMO overlays, none of
 * which read it. Fetching the pricing payload on `/` to satisfy a prop nothing
 * on this path uses would be a network round trip for no rendered pixel.
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

  // Nothing mounted, nothing fetched, until a row is actually pressed.
  if (!overlay) return null;

  return (
    <HomeOverlays
      current={overlay}
      onClose={() => setOverlay(null)}
      pricing={null}
    />
  );
}
