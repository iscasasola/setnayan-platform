/**
 * Loading screen for the Vendors tab — the couple "Services" nav target.
 *
 * Owner 2026-06-05 (two reports):
 *  (a) "from home, when we transfer to the services, there is a couple of
 *      seconds that it is blank … should have a loading state … prevent the
 *      user to do any other actions until the load state is done."
 *  (b) "loading state tells what we are doing … downloading your information,
 *      activating your personalized refinements. or something like this."
 *
 * The Vendors page (./_components/plan-budget-accordion.tsx) is a scroll-driven
 * sheet that REPLACES the app top-nav with a full-bleed black budget bar. This
 * loader mirrors that chrome so there's no header swap, and narrates the wait:
 *   · injects the SAME `.shell-topbar{display:none}` the live page injects,
 *   · paints the black budget bar (shimmer figs via the shared <Sk>),
 *   · fills the content area with a spinner + a cycling <LoadingStatus> that
 *     tells the couple what's loading — so the hop is never blank and nothing
 *     half-rendered is tappable until the real page streams in and replaces
 *     this fallback wholesale.
 */
import { Sk } from '@/components/skeletons';
import { LoadingStatus } from '@/components/loading-status';

// Chrome-only scoped CSS — the full-bleed black bar + negative top margin that
// match the live page's frame, plus the spinner + status cover.
const VLOAD_CSS = `
.vload{position:relative;margin-top:-24px;min-height:calc(100svh - 56px);background:var(--m-paper,#FBFBFA)}
html.dark .vload{background:#1E2229}
.vload-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:62px;padding:0 18px;background:var(--m-ink,#1E2229);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
html.dark .vload-bar{background:#2A2E36}
.vload-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:0 28px;min-height:62vh;text-align:center}
.vload-spin{width:38px;height:38px;border-radius:50%;border:3px solid rgba(197,160,89,.25);border-top-color:var(--m-orange,#C5A059);animation:vload-rot .7s linear infinite}
.vload-status{font-family:var(--font-sans,system-ui,sans-serif);font-size:14.5px;font-weight:600;letter-spacing:.01em;color:var(--m-ink,#1E2229);min-height:1.2em}
html.dark .vload-status{color:#FBFBFA}
.vload-sub{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(30,34,41,.4)}
html.dark .vload-sub{color:rgba(251,251,250,.45)}
@keyframes vload-rot{to{transform:rotate(360deg)}}
`;

const VLOAD_MESSAGES = [
  'Setting up your planner…',
  'Downloading your information…',
  'Activating your personalized refinements…',
  'Almost ready…',
];

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

      {/* Spinner + a cycling line that narrates what's loading. Fills the
          content area so nothing half-rendered is tappable until the page
          streams in. */}
      <div className="vload-cover">
        <div className="vload-spin" aria-hidden />
        <LoadingStatus className="vload-status" messages={VLOAD_MESSAGES} />
        <p className="vload-sub">Setnayan</p>
      </div>
    </div>
  );
}
