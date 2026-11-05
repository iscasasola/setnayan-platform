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
 *
 * ⬇ The content wrapper pads EXACTLY like the real event column's (`pb-6`, `app/dashboard/[eventId]/layout.tsx`) — it
 * was `pb-28`, 88 px of room the real page never had, and that hid the 2026-10-25 "the last line sits under the thumb
 * row" bug from every walk (`lib/a-thumb-row-leaves-room.test.ts` § 6 holds the two equal).
 */
import type { ReactNode } from 'react';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';

const BAR_CSS =
  '.sl-lab-bar{position:sticky;top:0;z-index:20;height:51px;display:flex;align-items:center;padding:0 12px;' +
  'font-size:14px;font-weight:600;letter-spacing:.18em;color:#A9834B;background:rgba(255,255,255,.55);' +
  '-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);' +
  'border-bottom:1px solid rgba(26,26,26,.1);transition:transform .3s ease-out}' +
  // Slid away where the REAL bar is (`front-door.css`: below 1024, except the event tree's 701–1023 tab band) —
  // it was `max-width:767.98px`, which no real page has.
  '@media (max-width:700.98px){.sl-lab-bar[data-hidden="true"]{transform:translateY(-100%)}}';

export function SuppliersLabStage({ children }: { children: ReactNode }) {
  const hidden = useHideOnScroll(true);
  return (
    // 🪤 THE APP'S OWN TWO ATTRIBUTES. `shellBarShows` (`use-shell-bar-offset.ts`) reads `[data-chrome='app']` and
    // `[data-boundary='tab']` to know whether a `data-hidden` bar is really off screen. Without them the lab's bar
    // counted as SHOWING while it was slid away, so `--sup-top` never dropped to 0 here as it does on a phone — and
    // the opened category's head never moved the way the owner saw it move (2026-10-29).
    <div className="sn-ambient min-h-screen" data-chrome="app" data-boundary="tab">
      <style>{BAR_CSS}</style>
      <div className="shell-topbar sl-lab-bar" data-hidden={hidden ? 'true' : 'false'} data-lab-bar="">
        SETNAYAN
      </div>
      <main className="sn-vt-page">
        <div data-shell-main>
          <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">{children}</div>
        </div>
      </main>
      <BottomDock>
        <nav className="flex h-16 items-center justify-around bg-cream/90 text-xs text-ink/70" data-lab-dock="">
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
