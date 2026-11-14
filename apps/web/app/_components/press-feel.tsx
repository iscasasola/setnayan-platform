'use client';

import { useEffect } from 'react';
import { SCRIM_SELECTOR } from '@/lib/scrim';
import { EASE_SPRING, TIMING, pressScale } from '@/lib/motion-timing';

/**
 * PressFeel — ONE press feel for every control the app owns, from ONE listener.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9): *"the animation when tapped on selector must feel the same on the
 * rest when pressed"* · *"we want the whole app to be adaptive to the same feel"* · *"the only part that does not
 * follow our rules is their customized event hub"*.
 *
 * Mounted ONCE, in the root layout. A single delegated `pointerdown` on the document (never a listener per element)
 * finds the control under the finger — the same set the stylesheet's universal press rule names (`PRESS_TARGETS`) —
 * and plays the press on it with the Web Animations API — 🎞 THE APPROVED TOUCH FEEL (owner 2026-11-13, DECISION_LOG
 * "Motion system approved", prototype `approved_2026-11-13/grow-full-screen-fable.html` § 6): IN on touch-down, 100 ms
 * ease-out (`--sn-dur-press`) to .97 — a row, anything 300 px or wider, only to .985 — with a pushed-in shade; it
 * HOLDS while the finger is down; OUT on lift, 280 ms on the house spring (`--sn-dur-release`). (Until 2026-11-13 it
 * was one 0.7 s dip-and-back to .93 played on touch-down whatever the finger did.) An animation COMPOSES with whatever
 * CSS transition the control carries (most pills wear `transition-colors`), so nothing snaps. A control that wears
 * `sn-press-ring` (or holds an element that does — a card's picture, a switch's track, the ⓘ's dot) also gets one
 * soft terracotta ring that widens and fades: a transient fixed element laid over its box, so it needs no `::after`.
 *
 * NEVER: inside the guest's Event Hub (`.sn-editorial`, the shell `GuestLookScope` puts around every guest page —
 * that page keeps its own press); on a disabled control. Under "reduce motion": the shade only, no scale (the table's
 * own fallback). Scale, transform and opacity only.
 * Without script the stylesheet's `:active` dimming still answers a press.
 */
export const PRESS_TARGETS = "button, [role='button'], a.button, .sn-press, input[type='submit'], input[type='button'], summary";
const SPRING = EASE_SPRING;

type Pressed = { closest(selector: string): unknown; matches(selector: string): boolean };

/**
 * 🌫 A SCRIM IS NEVER PRESSED (owner 2026-10-29: *"our scrim when tapped sometime show that the corners/edges brighten
 * showing it is a frame of the screen that pressed"*). The dark behind a pop-up is a full-screen <button>; the dip
 * shrank it to .93 and bared an undimmed frame of the page round the screen. A tap on it closes the pop-up and the
 * dark fades — that is its whole answer. The one list of what a scrim is: `SCRIM_SELECTOR` (`lib/scrim.ts`).
 */

/** May this control wear the press? Not in the guest's Event Hub, not a scrim, and not when it cannot be pressed. */
export function pressable(el: Pressed): boolean {
  return !el.closest('.sn-editorial') && !el.matches(SCRIM_SELECTOR) && !el.matches(':disabled, [aria-disabled="true"]');
}

/** A press is a ROW (it dips only to .985) when it is one of these, or 300 px or wider. */
export const PRESS_ROWS = '.sn-row, [data-fold-head], [data-swipe-row] [role="button"], [data-press-row]';

/** A time read from a token (`280ms` → 280; `0.28s` → 280); unreadable → `fallback`. */
export function pressMs(token: string, fallback: number = TIMING.releaseMs): number {
  const n = parseFloat(token);
  if (!(n > 0)) return fallback;
  return /\d\s*s$/.test(token.trim()) && !/ms$/.test(token.trim()) ? n * 1000 : n;
}

export function PressFeel() {
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const token = (name: string, fallback: number) => pressMs(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
    let held: { el: HTMLElement; dip: Animation | null; shade: HTMLElement; scale: number } | null = null;

    /* OUT — on lift (or a cancelled touch: the page scrolled instead): back to 1 on the house spring, the shade fades. */
    const release = () => {
      const h = held;
      held = null;
      if (!h) return;
      const ms = token('--sn-dur-release', TIMING.releaseMs);
      if (h.dip) {
        h.dip.cancel();
        h.el.animate([{ scale: h.scale }, { scale: 1 }], { duration: ms, easing: SPRING });
      }
      const out = h.shade.animate([{ opacity: 1, scale: h.dip ? h.scale : 1 }, { opacity: 0, scale: 1 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
      const gone = () => h.shade.remove();
      out.onfinish = gone;
      out.oncancel = gone;
    };

    /* IN — on touch-down: to .97 (a row .985) in 100 ms with a pushed-in shade, held while the finger is down. */
    const onDown = (e: PointerEvent) => {
      release();
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(PRESS_TARGETS);
      if (!el || !pressable(el) || !el.animate) return;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0)) return;
      const inMs = token('--sn-dur-press', TIMING.pressMs);
      const scale = pressScale(r.width, el.matches(PRESS_ROWS));
      const dip = still.matches ? null : el.animate([{ scale: 1 }, { scale }], { duration: inMs, easing: 'ease-out', fill: 'forwards' });
      /* The shade: a transient fixed element over the control's box (no `::after` — the control may already use it). */
      const shade = document.createElement('span');
      shade.setAttribute('aria-hidden', 'true');
      shade.dataset.pressShade = '';
      shade.style.cssText = `position:fixed;pointer-events:none;z-index:99;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:rgb(var(--color-ink) / .08);border-radius:${getComputedStyle(el).borderRadius}`;
      document.body.appendChild(shade);
      shade.animate([{ opacity: 0, scale: 1 }, { opacity: 1, scale: dip ? scale : 1 }], { duration: inMs, easing: 'ease-out', fill: 'forwards' });
      /* Held until the finger lifts — or the touch is taken by a scroll (pointercancel), or the window loses focus. */
      held = { el, dip, shade, scale };
      if (still.matches) return;
      const ringed = el.matches('.sn-press-ring') ? el : el.querySelector<HTMLElement>('.sn-press-ring');
      if (!ringed) return;
      const rr = ringed.getBoundingClientRect();
      if (!(rr.width > 0)) return;
      const ring = document.createElement('span');
      ring.setAttribute('aria-hidden', 'true');
      ring.dataset.pressRing = '';
      ring.style.cssText = `position:fixed;pointer-events:none;z-index:99;left:${rr.left}px;top:${rr.top}px;width:${rr.width}px;height:${rr.height}px;box-sizing:border-box;border:2px solid rgb(var(--sn-accent) / .45);border-radius:${getComputedStyle(ringed).borderRadius}`;
      document.body.appendChild(ring);
      /* It widens by ten pixels a side and fades — transform and opacity only. */
      const ms = token('--sn-pill-dur', TIMING.releaseMs);
      ring.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${1 + 20 / rr.width}, ${1 + 20 / rr.height})` }], { duration: ms * 1.3, easing: 'ease-out' }).onfinish = () => ring.remove();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
    return () => {
      release();
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', release);
    };
  }, []);
  return null;
}
