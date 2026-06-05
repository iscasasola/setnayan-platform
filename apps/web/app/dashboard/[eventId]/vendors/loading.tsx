/**
 * Loading screen for the Vendors tab — the couple "Services" nav target.
 *
 * Owner 2026-06-05 (verbatim): "from home, when we transfer to the services,
 * there is a couple of seconds that it is blank, this should have a loading
 * state. loading state should prevent the user to do any other actions until the
 * load state is done."
 *
 * The Vendors page (./_components/plan-budget-accordion.tsx) is a scroll-driven
 * sheet that REPLACES the app top-nav with a full-bleed black budget bar, then a
 * "Where your day stands" cover + coverflow rails. The shared ListPageSkeleton
 * this route used before mirrored a generic stats+list page on the normal white
 * chrome — so when it was replaced by the real sheet the top-nav appeared then
 * vanished and a black bar dropped in: the jump that read as a blank flash.
 *
 * This loader mirrors the Vendors chrome instead (the app-wide skeleton system's
 * own rule — "each route gets a loader that mirrors its own layout"):
 *   · injects the SAME `.shell-topbar{display:none}` the live page injects, so
 *     there's no header swap,
 *   · paints the full-bleed black budget bar + an intro/rail shimmer that fills
 *     the content area, so there's no blank and nothing half-rendered to tap
 *     until the real page streams in and replaces this fallback wholesale.
 *
 * Shimmer blocks reuse the shared <Sk> primitive (the `.skeleton` GPU sheen,
 * auto-frozen under prefers-reduced-motion by the global a11y block).
 */
import { Sk } from '@/components/skeletons';

// Chrome-only scoped CSS — the full-bleed black bar + negative top margin that
// match the live page's frame. Shimmer tint/sheen comes from <Sk>, not here.
const VLOAD_CSS = `
.vload{position:relative;margin-top:-24px;min-height:calc(100svh - 56px);background:var(--m-paper,#FBFBFA)}
html.dark .vload{background:#1E2229}
.vload-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:62px;padding:0 18px;background:var(--m-ink,#1E2229);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
html.dark .vload-bar{background:#2A2E36}
.vload-cover{padding:26px 22px 18px;display:flex;flex-direction:column;gap:16px}
.vload-stats{display:flex;gap:10px}
.vload-stats>*{flex:1}
.vload-rail{display:flex;gap:12px;overflow:hidden;padding-top:4px}
.vload-rail>*{flex:0 0 min(300px,calc(100vw - 96px))}
`;

export default function VendorsLoading() {
  return (
    <div className="vload" role="status" aria-busy="true" aria-live="polite">
      <style>{VLOAD_CSS}</style>
      {/* Match the live page: hide the app top-nav so there's no header swap
          when this fallback is replaced by the real Vendors sheet. */}
      <style>{`.shell-topbar{display:none}`}</style>
      <span className="sr-only">Loading your plan…</span>

      {/* Black budget bar — skeleton of TopBar (Chosen / Range · target). */}
      <div className="vload-bar">
        <div className="flex flex-col gap-2">
          <Sk className="h-3 w-28 rounded" />
          <Sk className="h-2.5 w-20 rounded" />
        </div>
        <Sk className="h-3 w-16 rounded" />
      </div>

      {/* "Where your day stands" cover — eyebrow + title, 3 stat boxes, and the
          first coverflow rail of cards. */}
      <div className="vload-cover">
        <div className="space-y-2.5">
          <Sk className="h-3 w-24 rounded" />
          <Sk className="h-8 w-3/4 max-w-[16rem] rounded-md" />
        </div>
        <div className="vload-stats">
          <Sk className="h-16 rounded-2xl" />
          <Sk className="h-16 rounded-2xl" />
          <Sk className="h-16 rounded-2xl" />
        </div>
        <div className="vload-rail">
          <Sk className="h-72 rounded-[18px]" />
          <Sk className="h-72 rounded-[18px]" />
          <Sk className="h-72 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
