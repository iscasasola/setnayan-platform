'use client';

import { useEffect } from 'react';
import { EASE_SETTLE, MOVE_MS, QUICK_MS, RISE_MS_STANDARD } from '@/lib/motion-table';

/**
 * ServiceIconPlay — plays the animated service icons on a press.
 *
 * Owner, Nov 2026, on the approved service-icons prototype: *"they change color when they are pressed and is
 * selected. then animate to lose the color again"*. Every `svg.si` (`lib/service-icon.ts`) inside the pressed
 * control gets `.go` for the play plus a beat. The colour comes on at once, its short play runs
 * (`app/service-icons.css`), then the colour fades back.
 *
 * 🩹 18 Nov 2026 — A TAP MUST BE SEEN (owner, live: *"when i tap the icons nothing is happening"*). Measured on
 * production that day: the press DOES start the play (`.go` lands, each part's animation is created) — but most of
 * these icons sit in a tile whose tap opens ANOTHER SCREEN (the service picker's category tile, a category row, a
 * folder link), so the tile left the page a frame or two later and took its icon with it. Now:
 *   · A TAP THAT LEAVES THE SCREEN — the play starts on touch-down, as before, and when the icon's tile is taken off
 *     the page mid-play a still-playing copy is CARRIED where the icon was (`.si-carry`, over the loading state),
 *     going on from where the play had got to, then fading (Quick on Settle). The navigation is never held back:
 *     nothing here prevents, delays or wraps the tap.
 *   · A TAP THAT STAYS — the full play, in place. A re-render that rewrites the icon's `class` mid-play (React sets
 *     the attribute whole) no longer cuts it: `.go` is put back before the next frame.
 * The times are the motion standard's (`lib/motion-table.ts` ↔ `--sn-m-*`): the play is Rise, the colour then holds
 * for Quick. 🔒 lib/a-tapped-service-icon-is-seen.test.ts
 *
 * Kept apart from `PressFeel` on purpose. That file is held to ONE listener, no timers and two imports by
 * `lib/the-press-feels-the-same-everywhere.test.ts`. This one does a different job (an icon's own play, not the
 * control's dip), and it needs a timer to end the play.
 *
 * Mounted ONCE, in the root layout. It is one delegated `pointerdown` on the document. A keyboard press
 * (Enter / Space) arrives as a click with no pointer, so `click` with `detail === 0` plays too. Links count.
 * Under "reduce motion" the stylesheet shortens the play rather than skipping it (the prototype's choice). Never
 * inside the guest's Event Hub (`.sn-editorial`).
 */
const HOSTS = "a, button, [role='button'], label, summary";
/** The play itself — `--md` in service-icons.css (Rise; Move under "reduce motion"). */
export const PLAY_MS = RISE_MS_STANDARD;
/** How long `.go` stays: the play, then a beat in colour before it fades back. */
export const HOLD_MS = PLAY_MS + QUICK_MS;

type Play = { at: number; rect: { left: number; top: number; width: number; height: number }; timer: number };
const plays = new Map<Element, Play>();
let watch: MutationObserver | null = null;

const playMsNow = (): number =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? MOVE_MS : PLAY_MS;

/**
 * What is left of a play that began `elapsedMs` ago: how far to skip into it, and how long the copy lives.
 * `null` = the play has run; there is nothing to carry.
 */
export function carryPlan(elapsedMs: number, playMs: number = PLAY_MS): { skipMs: number; leftMs: number } | null {
  if (!(elapsedMs >= 0) || elapsedMs >= playMs) return null;
  return { skipMs: Math.round(elapsedMs), leftMs: Math.round(playMs - elapsedMs) };
}

/** The pressed icon left the page mid-play: lay a still-playing copy where it was, and let it finish. */
function carry(icon: Element, play: Play): void {
  const plan = carryPlan(performance.now() - play.at, playMsNow());
  if (!plan || play.rect.width < 1 || play.rect.height < 1) return;
  const copy = icon.cloneNode(true) as Element;
  copy.classList.add('go');
  copy.removeAttribute('id');
  const box = document.createElement('span');
  box.className = 'si-carry';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = `left:${play.rect.left}px;top:${play.rect.top}px;width:${play.rect.width}px;height:${play.rect.height}px;--si-skip:-${plan.skipMs}ms`;
  box.appendChild(copy);
  document.body.appendChild(box);
  const gone = () => box.remove();
  window.setTimeout(() => {
    if (typeof box.animate !== 'function') return gone();
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: QUICK_MS, easing: EASE_SETTLE, fill: 'forwards' }).finished.then(gone, gone);
  }, plan.leftMs);
}

/** Something on the page changed while a play is running: carry what left, and keep `.go` on what stayed. */
function onPageChange(): void {
  for (const [icon, play] of plays) {
    if (!icon.isConnected) {
      window.clearTimeout(play.timer);
      plays.delete(icon);
      carry(icon, play);
    } else if (!icon.classList.contains('go')) {
      icon.classList.add('go'); // a re-render rewrote the class; same frame, so the play goes on uncut
    }
  }
  settle();
}

function settle(): void {
  if (plays.size === 0 && watch) {
    watch.disconnect();
    watch = null;
  }
}

export function playServiceIcons(target: Element): void {
  const host = target.closest(HOSTS) ?? target.closest('svg.si');
  if (!host || host.closest('.sn-editorial')) return;
  const icons = host.matches('svg.si') ? [host] : Array.from(host.querySelectorAll('svg.si'));
  for (const icon of icons) {
    const was = plays.get(icon);
    if (was) window.clearTimeout(was.timer);
    plays.delete(icon); // so the watcher does not put `.go` back while it is taken off to restart
    icon.classList.remove('go');
    const r = icon.getBoundingClientRect(); // restarts the play on a second quick press — and is where a copy is carried
    icon.classList.add('go');
    const timer = window.setTimeout(() => {
      plays.delete(icon);
      icon.classList.remove('go');
      settle();
    }, HOLD_MS);
    plays.set(icon, { at: performance.now(), rect: { left: r.left, top: r.top, width: r.width, height: r.height }, timer });
  }
  if (icons.length > 0 && !watch && typeof MutationObserver !== 'undefined') {
    // Only while a play is running (≤ HOLD_MS): the tile leaving, or its class being rewritten.
    watch = new MutationObserver(onPageChange);
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}

export function ServiceIconPlay() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element) playServiceIcons(e.target);
    };
    const onKeyClick = (e: MouseEvent) => {
      if (e.detail === 0 && e.target instanceof Element) playServiceIcons(e.target);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('click', onKeyClick, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('click', onKeyClick, true);
    };
  }, []);
  return null;
}
