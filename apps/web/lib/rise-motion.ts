/**
 * rise-motion.ts — ⤴ THE RISE: the ONE open/close motion of a picked row or a sheet (THE ONE BUILD F1, spec §0.6 and
 * §9 #16, 8 Nov 2026).
 *
 * The measured rules (spec §0.6): open 700 ms on `cubic-bezier(.2,.8,.2,1)` (owner 2026-11-10, DECISION_LOG "SIX ANSWERS"
 * (2), *"0.7s"* — was 520 ms; 700 is the family speed `--sn-pill-dur`, which `--sn-dur-rise` reads); the close is the
 * EXACT reverse (the same frames played backwards from the same origin rect); no jump over 40 px and no pause over 90 ms — a single transform
 * animation from the tapped row's rect to the sheet's own rect gives both. Under reduced motion it is a 120 ms
 * cross-fade (no movement). The numbers are tokens too (`--sn-dur-rise`, `--sn-ease-rise`, `--sn-dur-rise-reduced` in
 * globals.css) for anything drawn in CSS.
 *
 * ⚡ SUPERSEDED NUMBERS (owner 2026-11-13, DECISION_LOG "Motion system approved"): the rise is now 360 ms on the emphasized
 * curve `cubic-bezier(.2,0,0,1)` and closes as the mirror at 80 % (`lib/grow-motion.ts`); the 700 ms above is history.
 *
 * Consumers: the picked client in Clients (it rises from the tapped list row and falls back into it). Neutral module —
 * the frames are pure (tested); `riseFromRect` uses the Web Animations API and does nothing on the server.
 * 🔒 app/_components/collapsing-top/the-top-scrolls-up-and-locks.test.ts (the rise's numbers and its reverse)
 * 🔒 lib/the-motion-system-is-shared.test.ts (one number, nobody keeps their own)
 */

import { EASE_EMPH, TIMING } from '@/lib/grow-motion';

// 🎞 2026-11-13 "Motion system approved": the faster numbers REPLACE the 0.7 s rise — the shape opens in 360 ms on the
// emphasized curve; the numbers live in `lib/grow-motion.ts` (mirroring `--sn-dur-open` / `--sn-ease-emph`).
export const RISE_MS = TIMING.openMs;
export const RISE_EASE = EASE_EMPH;
export const RISE_REDUCED_MS = TIMING.reducedMs;

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

/**
 * 🃏 THE COVER MORPH (Service card grown — prototype `service-card-maker.html` `heroClipFrom`, run at the house 0.7 s):
 * while the layer rises from the tapped card's box, the hero's own clip starts on the tapped card's COVER and opens to
 * the full hero. Returns the starting `clip-path` in the HERO's own (untransformed) coordinates — the cover's screen box
 * mapped back through the rise's first frame (`riseFrames(from, to)`), so at frame 0 the clip sits exactly over the
 * cover. Each inset is clamped to the hero, so a cover that sits outside it still yields a valid clip. Pure.
 */
export function heroClipFrom(hero: RiseRect, cover: RiseRect, from: RiseRect, to: RiseRect, radius = 8): string {
  const sx = to.width > 0 && from.width > 0 ? from.width / to.width : 1;
  const sy = to.height > 0 && from.height > 0 ? from.height / to.height : 1;
  const left = to.left + (cover.left - from.left) / sx;
  const top = to.top + (cover.top - from.top) / sy;
  const right = left + cover.width / sx;
  const bottom = top + cover.height / sy;
  const fit = (n: number, max: number) => Math.round(Math.min(Math.max(n, 0), Math.max(max, 0)) * 10) / 10;
  const t = fit(top - hero.top, hero.height);
  const b = fit(hero.top + hero.height - bottom, hero.height - t);
  const l = fit(left - hero.left, hero.width);
  const r = fit(hero.left + hero.width - right, hero.width - l);
  return `inset(${t}px ${r}px ${b}px ${l}px round ${radius}px)`;
}

/** The hero at rest — the clip the morph ends on. */
export const HERO_CLIP_OPEN = 'inset(0px 0px 0px 0px round 0px)';

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
  // The close is the mirror at 80 % (2026-11-13): the same frames backwards, in four fifths of the time.
  const duration = reverse ? Math.round(RISE_MS * TIMING.closeRatio) : RISE_MS;
  return el.animate(riseFrames(from, to), { duration, easing: RISE_EASE, direction: reverse ? 'reverse' : 'normal', fill: 'both' });
}
