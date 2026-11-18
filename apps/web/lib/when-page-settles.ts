/**
 * lib/when-page-settles.ts — RUN A BACKGROUND CHECK ONCE THE PAGE HAS LOADED AND THE BROWSER IS IDLE.
 *
 * ⚡ Speed pass 2026-11-18 (owner: every page under 0.7 s at 390 px). Every full page load ran the stale-tab check
 * (`/api/health`) from its mount effect — while the page's own scripts, styles and reads were still arriving. The check
 * answers a question about a tab left open across a deploy; it never draws anything on first paint. It still runs on
 * every load, exactly once, with the same answer — it only waits for the `load` event and an idle moment (at most
 * `timeoutMs` more), so it never competes with what the person is waiting to see.
 *
 * Returns a cancel function (an unmounted component never runs the check).
 */
export function whenPageSettles(cb: () => void, timeoutMs = 3_000): () => void {
  if (typeof window === 'undefined') return () => {};
  let cancelled = false;
  let idleId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (!cancelled) cb();
  };
  const schedule = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(run, { timeout: timeoutMs });
    else timer = setTimeout(run, 1);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', schedule);
    if (idleId !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    if (timer !== null) clearTimeout(timer);
  };
}
