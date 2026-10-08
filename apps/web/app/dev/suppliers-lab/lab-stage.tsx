'use client';

/**
 * The Suppliers lab's stand-ins for the app shell (client): the top bar that
 * SLIDES AWAY on a phone as the page scrolls down and back as it scrolls up,
 * and the bottom bar. The bar reads the app's own `useHideOnScroll`, carries
 * the app's own hook (`shell-topbar` + `data-hidden`) and moves on the app's
 * own curve (`.fd-topwrap` in `frontdoor/front-door.css`: `transform 0.3s
 * ease-out`, slid away below 768 px only) — so the pinned block under it is
 * measured against the motion the real page has, not against a bar that never
 * moves.
 */
import type { ReactNode } from 'react';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';

const BAR_CSS =
  '.sl-lab-bar{position:sticky;top:0;z-index:20;height:51px;display:flex;align-items:center;padding:0 12px;' +
  'font-size:14px;font-weight:600;letter-spacing:.18em;color:#A9834B;background:rgba(255,255,255,.55);' +
  '-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);' +
  'border-bottom:1px solid rgba(26,26,26,.1);transition:transform .3s ease-out}' +
  '@media (max-width:767.98px){.sl-lab-bar[data-hidden="true"]{transform:translateY(-100%)}}';

export function SuppliersLabStage({ children }: { children: ReactNode }) {
  const hidden = useHideOnScroll(true);
  return (
    <div className="sn-ambient min-h-screen">
      <style>{BAR_CSS}</style>
      <div className="shell-topbar sl-lab-bar" data-hidden={hidden ? 'true' : 'false'} data-lab-bar="">
        SETNAYAN
      </div>
      <main className="sn-vt-page">
        <div data-shell-main>
          <div className="mx-auto w-full px-4 pb-28 pt-3 sm:px-6 sm:pt-6 lg:px-8">{children}</div>
        </div>
      </main>
      <BottomDock>
        <nav className="flex h-16 items-center justify-around bg-white/90 text-xs text-ink/70" data-lab-dock="">
          <span>Home</span>
          <span>Guests</span>
          <span>Suppliers</span>
          <span>Hub</span>
          <span>More</span>
        </nav>
      </BottomDock>
    </div>
  );
}
