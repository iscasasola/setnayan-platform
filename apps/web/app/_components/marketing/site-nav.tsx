'use client';

/**
 * Shared marketing top chrome — the ELN-reskin floating glass nav.
 *
 * REWRITTEN 2026-07-03 (owner: "pull the old-site pages onto the new website —
 * different top nav and footer style"): the old 6-link row nav (Explore /
 * Setnayan AI / For vendors / Our story / Journal / Real Stories + PromoBar)
 * is replaced by the SAME floating glass nav the reskin homepage ships —
 * [logo] · Prices · Download · Vendors · [Sign in] — so clicking off the
 * homepage no longer lands on the old website's chrome. Prices / Download /
 * Vendors / Sign in open the same overlays as on the homepage (see
 * HomeOverlays); cross-page NAVIGATION moves to the footer, which pins itself
 * open when used (see reskin-footer.tsx + footer-pin.ts).
 *
 * Markup + classes mirror HomeReskin's nav 1:1 (hr-nav / hr-glass-dark /
 * hr-logo / hr-links / hr-signin) and reuse home-reskin.css via the
 * `.home-reskin.hr-open` scope — the "unlocked" ink-glass state, correct on
 * the light marketing pages. The homepage keeps its own nav instance because
 * it needs the gate state (white-on-cinematic → ink-on-open) and scroll-home
 * behavior; keep the two in sync when the nav design changes.
 *
 * NAV-REGISTRY CHOKEPOINT (lint-nav-icon-source.mjs, REQUIRED check): labels
 * still come from the registry — `navSlots` is resolved server-side in the
 * root layout and threaded down via SiteChrome. The four items carry NEW
 * `public.site-nav.*` slot keys (prices / download / vendors-overlay /
 * sign-in, seeded in lib/nav-registry-defaults.ts); the six old link slots
 * stay seeded-but-inert, per the registry's documented pattern for retired
 * affordances. Fails open to the literal labels below.
 *
 * Every press calls unpinFooter() — the owner-specified counterpart of the
 * pinned footer: "until top nav is pressed, which will animate the footer to
 * hide once again."
 */

import Link from 'next/link';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { OverlayId } from '@/app/_components/home/HomeOverlays';
import { unpinFooter } from './footer-pin';

export function Nav({
  navSlots,
  onOpenOverlay,
  unfixed = false,
}: {
  navSlots?: Record<string, NavSlotLite>;
  onOpenOverlay: (id: Exclude<OverlayId, null>) => void;
  /**
   * /explore's marketplace search bar is itself sticky-top; a fixed glass nav
   * would stack on it forever. `unfixed` renders the nav absolutely positioned
   * instead, so it scrolls away with the page — the same intent the old nav's
   * `sticky={false}` carried.
   */
  unfixed?: boolean;
}) {
  const label = (slot: string, fallback: string) => {
    const s = navSlots?.[slot];
    if (s?.isHidden) return null; // admin hid this item from /admin/menus
    return s?.label ?? fallback;
  };

  const prices = label('public.site-nav.prices', 'Prices');
  const download = label('public.site-nav.download', 'Download');
  const vendors = label('public.site-nav.vendors-overlay', 'Vendors');
  const signin = label('public.site-nav.sign-in', 'Sign in');

  const press = (id: Exclude<OverlayId, null>) => {
    unpinFooter();
    onOpenOverlay(id);
  };

  return (
    <div className={`home-reskin hr-open hr-chrome-nav${unfixed ? ' hr-nav-unfixed' : ''}`}>
      <nav className="hr-nav">
        <Link
          className="hr-logo hr-glass-dark"
          aria-label="Home"
          title="Home"
          href="/"
          onClick={() => unpinFooter()}
        >
          <SetnayanMark className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="hr-links hr-glass-dark">
          {prices && <button onClick={() => press('prices')}>{prices}</button>}
          {download && <button onClick={() => press('download')}>{download}</button>}
          {vendors && <button onClick={() => press('vendors')}>{vendors}</button>}
        </div>
        {signin && (
          <button className="hr-signin hr-glass-dark" onClick={() => press('signin')}>
            {signin}
          </button>
        )}
      </nav>
    </div>
  );
}
