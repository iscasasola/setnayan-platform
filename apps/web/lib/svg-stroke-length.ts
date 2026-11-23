/**
 * svg-stroke-length.ts — measure an SVG stroke only where the browser can.
 *
 * Live crash, 2026-11-23 (`app_telemetry_logs`, PAGE_CRASH on /schedule, and the
 * same fingerprint earlier on /seat-plan, /monogram, /mood-board, /pakanta):
 * `TypeError: n.getTotalLength is not a function`, thrown inside the useGSAP
 * scope of `usePanelIntro` (`app/_components/marketing/_premium.tsx`). Some
 * clients render the doorway's `<path data-premium-thread>` without the
 * SVGGeometryElement methods (jsdom-style renderers, link-preview bots, old or
 * stripped WebKit builds), and an unguarded `path.getTotalLength()` took the
 * whole page down to the root error screen for a purely decorative line.
 *
 * The honest degrade: if the method is missing, there is no length to draw from,
 * so the caller skips the draw-in and the line simply rests in its final, drawn
 * state. No try/catch: a method that exists and returns a number is trusted.
 */

/** Anything that may or may not carry SVGGeometryElement.getTotalLength. */
export type MaybeMeasurable = { getTotalLength?: unknown } | null | undefined;

/**
 * The stroke length of `el`, or 0 when it cannot be measured (no element, no
 * `getTotalLength`, or a non-finite / non-positive length). 0 means "do not
 * animate this stroke": callers already treat a falsy length as "rest drawn".
 */
export function strokeLengthOrZero(el: MaybeMeasurable): number {
  if (!el || typeof el.getTotalLength !== 'function') return 0;
  const len = (el.getTotalLength as () => unknown).call(el);
  return typeof len === 'number' && Number.isFinite(len) && len > 0 ? len : 0;
}
