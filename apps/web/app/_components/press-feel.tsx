'use client';

import { useEffect } from 'react';
import { SCRIM_SELECTOR } from '@/lib/scrim';

/**
 * PressFeel — ONE press feel for every control the app owns, from ONE listener.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9): *"the animation when tapped on selector must feel the same on the
 * rest when pressed"* · *"we want the whole app to be adaptive to the same feel"* · *"the only part that does not
 * follow our rules is their customized event hub"*.
 *
 * Mounted ONCE, in the root layout. A single delegated `pointerdown` on the document (never a listener per element)
 * finds the control under the finger — the same set the stylesheet's universal press rule names (`PRESS_TARGETS`).
 *
 * 🎞 13 Nov 2026 — THE APPROVED TOUCH FEEL (owner "motion approved", grow-full-screen-fable.html "Touch feel" + § 6
 * timing table; it REPLACES the 8 Oct 0.7 s dip): the press goes IN on touch-down — fast, 100 ms ease-out to 0.97 (a
 * row 0.985) and held, so it looks pushed in — and springs back on LIFT, 280 ms on the house spring. The row's MAIN
 * button also sends a soft ripple from the real touch point (520 ms). The numbers are the table's tokens
 * (`--sn-m-press-in`, `--sn-m-release`, `--sn-m-ripple`), read when pressed. Still ONE delegated set of listeners on
 * the document (down · up · cancel) — never one per element. An animation COMPOSES with whatever CSS transition the
 * control carries, so nothing snaps. A control that wears `sn-press-ring` (or holds an element that does — a card's
 * picture, a switch's track, the ⓘ's dot) also gets one soft terracotta ring that widens and fades: a transient fixed
 * element laid over its box, so it needs no `::after`.
 *
 * NEVER: inside the guest's Event Hub (`.sn-editorial`, the shell `GuestLookScope` puts around every guest page —
 * that page keeps its own press); on a disabled control; under "reduce motion". Scale, transform and opacity only.
 * Without script the stylesheet's `:active` dimming still answers a press.
 */
export const PRESS_TARGETS = "button, [role='button'], a.button, .sn-press, input[type='submit'], input[type='button'], summary";
/** A ROW presses gentler (0.985) than a button (0.97) — the timing table's "Row press". */
export const ROW_PRESS_TARGETS = '[data-fold-head], [data-row-press]';
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const PRESS_IN_EASE = 'ease-out';

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

/** A duration read from a token (`280ms` → 280; `0.28s` → 280); `fallback` when the token is missing or nonsense. */
export function pressMs(token: string, fallback = 280): number {
  const n = parseFloat(token);
  if (!(n > 0)) return fallback;
  return /\d\s*s$/.test(token.trim()) && !/ms$/.test(token.trim()) ? n * 1000 : n;
}

export function PressFeel() {
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let held: { el: HTMLElement; to: number; press: Animation } | null = null;
    const token = (name: string, fallback: number) => pressMs(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
    const onDown = (e: PointerEvent) => {
      // Reduced motion: shade only — the stylesheet's `:active` dimming answers the press, nothing scales.
      if (still.matches || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(PRESS_TARGETS);
      if (!el || !pressable(el) || !el.animate) return;
      const to = el.matches(ROW_PRESS_TARGETS) ? 0.985 : 0.97;
      // IN — fast, and held while the finger is down.
      held = { el, to, press: el.animate([{ scale: 1 }, { scale: to }], { duration: token('--sn-m-press-in', 100), easing: PRESS_IN_EASE, fill: 'forwards' }) };
      const r = el.getBoundingClientRect();
      if (!(r.width > 0)) return;
      // 💧 The row's MAIN button: a soft ripple from the real touch point, clipped to the button's own shape.
      if (el.matches('[data-main]') && !el.matches(ROW_PRESS_TARGETS)) {
        const clip = document.createElement('span');
        clip.setAttribute('aria-hidden', 'true');
        clip.dataset.pressRipple = '';
        clip.style.cssText = `position:fixed;pointer-events:none;z-index:99;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;border-radius:${getComputedStyle(el).borderRadius}`;
        const d = 2 * Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY));
        const dot = document.createElement('span');
        dot.style.cssText = `position:absolute;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px;border-radius:50%;background:rgb(255 255 255 / .35)`;
        clip.appendChild(dot);
        document.body.appendChild(clip);
        dot.animate([{ opacity: 1, transform: 'scale(0)' }, { opacity: 0, transform: 'scale(1)' }], { duration: token('--sn-m-ripple', 520), easing: 'ease-out' }).onfinish = () => clip.remove();
      }
      const ringed = el.matches('.sn-press-ring') ? el : el.querySelector<HTMLElement>('.sn-press-ring');
      if (!ringed) return;
      const rr = ringed.getBoundingClientRect();
      if (!(rr.width > 0)) return;
      const ring = document.createElement('span');
      ring.setAttribute('aria-hidden', 'true');
      ring.dataset.pressRing = '';
      ring.style.cssText = `position:fixed;pointer-events:none;z-index:99;left:${rr.left}px;top:${rr.top}px;width:${rr.width}px;height:${rr.height}px;box-sizing:border-box;border:2px solid rgb(var(--sn-accent) / .45);border-radius:${getComputedStyle(ringed).borderRadius}`;
      document.body.appendChild(ring);
      /* It widens by ten pixels a side and fades — transform and opacity only — over the ripple's time. */
      ring.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${1 + 20 / rr.width}, ${1 + 20 / rr.height})` }], { duration: token('--sn-m-ripple', 520), easing: 'ease-out' }).onfinish = () => ring.remove();
    };
    // OUT — on lift (or a cancelled touch): back to 1 on the house spring, then nothing is held.
    const onUp = () => {
      if (!held) return;
      const { el, to, press } = held;
      held = null;
      const back = el.animate([{ scale: to }, { scale: 1 }], { duration: token('--sn-m-release', 280), easing: SPRING });
      press.cancel();
      back.onfinish = () => back.cancel();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
    };
  }, []);
  return null;
}
