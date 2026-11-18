/**
 * rise-motion.ts — ⤴ THE RISE: the ONE open/close motion of a picked row or a sheet (THE ONE BUILD F1, spec §0.6 and
 * §9 #16, 8 Nov 2026).
 *
 * The measured rules (spec §0.6, numbers since 13 Nov 2026 from the approved grow — see `RISE_MS` below; the 700 ms of
 * 10 Nov and the 520 ms before it are retired); the close is the
 * EXACT reverse (the same frames played backwards from the same origin rect); no jump over 40 px and no pause over 90 ms — a single transform
 * animation from the tapped row's rect to the sheet's own rect gives both. Under reduced motion it is a 120 ms
 * cross-fade (no movement). The numbers are tokens too (`--sn-dur-rise`, `--sn-ease-rise`, `--sn-dur-rise-reduced` in
 * globals.css) for anything drawn in CSS.
 *
 * Consumers: the picked client in Clients (it rises from the tapped list row and falls back into it). Neutral module —
 * the frames are pure (tested); `riseFromRect` uses the Web Animations API and does nothing on the server.
 * 🔒 app/_components/collapsing-top/the-top-scrolls-up-and-locks.test.ts (the rise's numbers and its reverse)
 * 🔒 lib/the-rise-is-0-7s.test.ts (kept by name: one number — Move 320 since 18 Nov — and nobody keeps their own)
 */

import { EASE_EMPHASIZED, MOTION_TABLE } from '@/lib/motion-table';

/**
 * ⏱ 13 Nov 2026 — the 0.7 s rise is REPLACED by the approved grow (owner "motion approved", grow-full-screen-fable.html
 * § "Why these numbers"; DECISION_LOG 2026-11-13 "Motion system approved"); 18 Nov 2026 retimed onto the motion standard
 * (owner *"Combine them"*, MOTION_STANDARD_2026-11-18.md § 0): the SHAPE opens in Move 320 ms on Settle after the Tap
 * 100 ms press, and the close plays the same frames backwards at 80 % (256 ms) — played in reverse, Settle IS the
 * table's reversed curve `(.8,0,.8,.2)`. The numbers live in `lib/motion-table.ts`; these names stay so every caller
 * keeps reading the one rise.
 */
export const RISE_MS = MOTION_TABLE.growShapeMs;
export const RISE_EASE = EASE_EMPHASIZED;
/** The close: every window mirrored, at 80 % of the open. */
export const RISE_CLOSE_MS = Math.round(MOTION_TABLE.growShapeMs * MOTION_TABLE.growCloseFactor);
export const RISE_REDUCED_MS = MOTION_TABLE.reducedFadeMs;

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
  return el.animate(riseFrames(from, to), { duration: reverse ? RISE_CLOSE_MS : RISE_MS, easing: RISE_EASE, direction: reverse ? 'reverse' : 'normal', fill: 'both' });
}
