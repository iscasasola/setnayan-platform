'use client';

/**
 * The Guests lab's stand-in for the shell's top bar (client) — it SLIDES AWAY on a phone as the page scrolls down and
 * comes back as it scrolls up, like the real one: the app's own `useHideOnScroll`, the app's own hook (`shell-topbar` +
 * `data-hidden`), the app's own curve (`.fd-topwrap` in `frontdoor/front-door.css`: `transform 0.3s ease-out`, slid away
 * below 701 px), and the safe-area top padding the real bar carries. The wrapper that holds it must carry
 * `data-chrome="app"` (`shellBarShows` reads it — `use-shell-bar-offset.ts`).
 *
 * Why (owner, live iPhone app, 2026-10-30: *"something is peeking on the top of guests"*): the old stand-in never moved,
 * so `--gs-top` never dropped to the safe area here as it does on a phone, and the strip above the pinned row — where
 * the list showed through once the bar had slid away — could not be seen in a walk. Same lesson as the Suppliers lab's
 * stage (`app/dev/suppliers-lab/lab-stage.tsx`).
 */
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';

const BAR_CSS =
  '.gl-lab-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;box-sizing:content-box;height:60px;' +
  'padding:env(safe-area-inset-top,0px) 16px 0;font-size:14px;font-weight:600;letter-spacing:.18em;color:#A9834B;' +
  'background:rgba(255,255,255,.9);border-bottom:1px solid rgba(26,26,26,.1);transition:transform .3s ease-out}' +
  '@media (max-width:700.98px){.gl-lab-bar[data-hidden="true"]{transform:translateY(-100%)}}';

export function LabTopBar() {
  const hidden = useHideOnScroll(true);
  return (
    <>
      <style>{BAR_CSS}</style>
      <div className="shell-topbar gl-lab-bar" data-hidden={hidden ? 'true' : 'false'} data-lab-bar="">
        SETNAYAN
      </div>
    </>
  );
}
