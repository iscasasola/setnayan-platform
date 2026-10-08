'use client';

import { useEffect } from 'react';

/**
 * PressFeel — ONE press feel for every control the app owns, from ONE listener.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9): *"the animation when tapped on selector must feel the same on the
 * rest when pressed"* · *"we want the whole app to be adaptive to the same feel"* · *"the only part that does not
 * follow our rules is their customized event hub"*.
 *
 * Mounted ONCE, in the root layout. A single delegated `pointerdown` on the document (never a listener per element)
 * finds the control under the finger — the same set the stylesheet's universal press rule names (`PRESS_TARGETS`) —
 * and plays the dip and the spring back on it with the Web Animations API: a dip to .93 a third of the way in, back
 * with a small overshoot, at the press family's one speed (`--sn-pill-dur`). An animation COMPOSES with whatever
 * CSS transition the control carries (most pills wear `transition-colors`), so nothing snaps. A control that wears
 * `sn-press-ring` (or holds an element that does — a card's picture, a switch's track, the ⓘ's dot) also gets one
 * soft terracotta ring that widens and fades: a transient fixed element laid over its box, so it needs no `::after`.
 *
 * NEVER: inside the guest's Event Hub (`.sn-editorial`, the shell `GuestLookScope` puts around every guest page —
 * that page keeps its own press); on a disabled control; under "reduce motion". Scale, transform and opacity only.
 * Without script the stylesheet's `:active` dimming still answers a press.
 */
export const PRESS_TARGETS = "button, [role='button'], a.button, .sn-press, input[type='submit'], input[type='button'], summary";
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

type Pressed = { closest(selector: string): unknown; matches(selector: string): boolean };

/** May this control wear the press? Not in the guest's Event Hub, and not when it cannot be pressed. */
export function pressable(el: Pressed): boolean {
  return !el.closest('.sn-editorial') && !el.matches(':disabled, [aria-disabled="true"]');
}

/** The family's one speed, read from the token (`700ms` → 700; `0.7s` → 700). */
export function pressMs(token: string): number {
  const n = parseFloat(token);
  if (!(n > 0)) return 700;
  return /\d\s*s$/.test(token.trim()) && !/ms$/.test(token.trim()) ? n * 1000 : n;
}

export function PressFeel() {
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onDown = (e: PointerEvent) => {
      if (still.matches || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(PRESS_TARGETS);
      if (!el || !pressable(el) || !el.animate) return;
      const ms = pressMs(getComputedStyle(document.documentElement).getPropertyValue('--sn-pill-dur'));
      el.animate([{ scale: 1 }, { scale: 0.93, offset: 0.35 }, { scale: 1 }], { duration: ms, easing: SPRING });
      const ringed = el.matches('.sn-press-ring') ? el : el.querySelector<HTMLElement>('.sn-press-ring');
      if (!ringed) return;
      const r = ringed.getBoundingClientRect();
      if (!(r.width > 0)) return;
      const ring = document.createElement('span');
      ring.setAttribute('aria-hidden', 'true');
      ring.dataset.pressRing = '';
      ring.style.cssText = `position:fixed;pointer-events:none;z-index:99;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;box-sizing:border-box;border:2px solid rgb(var(--color-mulberry) / .45);border-radius:${getComputedStyle(ringed).borderRadius}`;
      document.body.appendChild(ring);
      /* It widens by ten pixels a side and fades — transform and opacity only. */
      ring.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${1 + 20 / r.width}, ${1 + 20 / r.height})` }], { duration: ms * 1.3, easing: 'ease-out' }).onfinish = () => ring.remove();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
  return null;
}
