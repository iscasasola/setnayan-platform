/**
 * rise-motion.ts — ⤴ THE RISE: the ONE open/close motion of a picked row or a sheet (THE ONE BUILD F1, spec §0.6 and
 * §9 #16, 8 Nov 2026).
 *
 * The measured rules (spec §0.6): open 520 ms on `cubic-bezier(.2,.8,.2,1)`; the close is the EXACT reverse (the same
 * frames played backwards from the same origin rect); no jump over 40 px and no pause over 90 ms — a single transform
 * animation from the tapped row's rect to the sheet's own rect gives both. Under reduced motion it is a 120 ms
 * cross-fade (no movement). The numbers are tokens too (`--sn-dur-rise`, `--sn-ease-rise`, `--sn-dur-rise-reduced` in
 * globals.css) for anything drawn in CSS.
 *
 * Consumers: the picked client in Clients (it rises from the tapped list row and falls back into it). Neutral module —
 * the frames are pure (tested); `riseFromRect` uses the Web Animations API and does nothing on the server.
 * 🔒 app/_components/collapsing-top/the-top-scrolls-up-and-locks.test.ts (the rise's numbers and its reverse)
 */

export const RISE_MS = 520;
export const RISE_EASE = 'cubic-bezier(.2,.8,.2,1)';
export const RISE_REDUCED_MS = 120;

export type RiseRect = { left: number; top: number; width: number; height: number };

/**
 * The two frames that carry an element drawn at `to` so it starts exactly over `from` and ends at rest. Transform only
 * (no layout per frame); `transform-origin: 0 0` is applied by `riseFromRect`. A zero-size rect never divides by zero.
 */
export function riseFrames(from: RiseRect, to: RiseRect): Keyframe[] {
  const sx = to.width > 0 ? from.width / to.width : 1;
  const sy = to.height > 0 ? from.height / to.height : 1;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [{ transform: `translate(${r(dx)}px, ${r(dy)}px) scale(${r(sx)}, ${r(sy)})` }, { transform: 'none' }];
}

/** The cross-fade used under reduced motion. */
export const RISE_REDUCED_FRAMES: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

/**
 * Play the rise on `el` from `from` (open), or — `reverse: true` — the exact reverse back into `from` (close). Returns the
 * Animation (await `.finished` before unmounting on close), or null where the API is missing (the element simply shows).
 */
export function riseFromRect(el: HTMLElement, from: RiseRect, { reverse = false }: { reverse?: boolean } = {}): Animation | null {
  if (typeof window === 'undefined' || typeof el.animate !== 'function') return null;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduce) {
    return el.animate(RISE_REDUCED_FRAMES, { duration: RISE_REDUCED_MS, easing: 'linear', direction: reverse ? 'reverse' : 'normal', fill: 'both' });
  }
  const to = el.getBoundingClientRect();
  el.style.transformOrigin = '0 0';
  return el.animate(riseFrames(from, to), { duration: RISE_MS, easing: RISE_EASE, direction: reverse ? 'reverse' : 'normal', fill: 'both' });
}
