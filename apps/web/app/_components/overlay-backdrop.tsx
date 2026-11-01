'use client';

import { useLayoutEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { SCRIM_SELECTOR, scrimFadeMs } from '@/lib/scrim';

/**
 * 🌫 THE ONE BACKDROP BEHIND A POP-UP (owner 2026-10-25: *"the darken also moves and does not darken and blurr
 * background … will not be scrollable or tappable until pop up is gone via tapping the darkened space or closing the
 * popup. just implement it across all"*) — and THE ONE SCRIM (owner 2026-10-29: *"the darkness of each scrims from
 * different places are different"* · *"i dont want it to show edges. Tapping on it will just fade cleanly. When the
 * scrim is on, i want a partial blur to keep focus on the pop up"*).
 *
 *   · `position: fixed; inset: 0` — pinned to the SCREEN, never to the page, so it cannot move or scroll with what is
 *     behind it; it covers the whole viewport, the bottom bar included (it sits on the pop-up's own layer).
 *   · dark AND partly blurred — `.sn-popup-dark`, which reads the scrim tokens (`--sn-scrim`, `--sn-scrim-blur`,
 *     `lib/scrim.ts`); one darkness everywhere, light and dark mode, reduced-transparency fallback;
 *   · NO EDGE: never dipped by the press feel (`SCRIM_SELECTOR`), no focus ring, no tap highlight, no border, radius
 *     or shadow (`globals.css` "THE ONE SCRIM") — nothing can outline the screen;
 *   · fades in on opacity (`.sn-fade`) and fades OUT when it goes: a still copy is laid where it was and faded over
 *     `--sn-scrim-fade` (an unmounted element cannot animate). Not under "reduce motion" — there it simply goes;
 *   · ONE BLUR AT A TIME: a scrim opened over another scrim is marked `data-scrim-stacked` and dims without blurring
 *     again, so two sheets never stack two blurred layers on a phone;
 *   · `touch-action: none` + `overscroll-behavior: none` — a drag on the dimmed area moves nothing;
 *   · a tap on it closes the pop-up (it is a real <button>, so a keyboard reaches it too; the pop-up's own Close and
 *     Escape close it as well).
 * The page behind is held still and made inert by `useModalA11y` (`lib/overlay-lock.ts`), which every overlay calls.
 * 🔒 `lib/one-backdrop-everywhere.test.ts` (no hand-made dimmer) · `lib/one-scrim.test.ts` (one darkness, no edge).
 */
export function OverlayBackdrop({
  onClose,
  label = 'Close',
  fade = true,
  className = '',
  style,
  ...rest
}: {
  onClose: () => void;
  label?: string;
  /** Fade in on opacity. Default on. */
  fade?: boolean;
  /** Layering and responsive visibility only (`z-[75]`, `lg:hidden`) — never a colour; the colour is the token's. */
  className?: string;
  style?: React.CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'style' | 'type' | 'aria-label' | 'children'>) {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* One blur at a time: another scrim is already up → this one only dims. */
    const others = Array.from(document.querySelectorAll(SCRIM_SELECTOR)).filter(
      (n) => n !== el && !n.hasAttribute('data-scrim-leaving'),
    );
    if (others.length > 0) el.setAttribute('data-scrim-stacked', '');
    /* The layer it sits on, read now while it is on the page, for the fade-out copy. */
    let z = 'var(--sn-z-scrim)';
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const zi = getComputedStyle(n).zIndex;
      if (zi && zi !== 'auto') {
        z = zi;
        break;
      }
    }
    return () => fadeOutCopy(el, z);
  }, []);
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onClose}
      data-overlay-backdrop=""
      className={`sn-popup-dark fixed inset-0 block min-h-0 w-full cursor-default touch-none overscroll-none p-0${fade ? ' sn-fade' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    />
  );
}

/** Lay a still copy of the scrim where it was and fade it out — the clean fade a tap ends in. */
function fadeOutCopy(el: HTMLElement, z: string) {
  if (typeof window === 'undefined' || !el.isConnected || !el.animate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cs = getComputedStyle(el);
  /* Only a dark that was actually on screen fades — a hidden pop-up's scrim never flashes on its way out. */
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || el.getClientRects().length === 0) return;
  const cls = el.className.replace(/\bsn-fade\b/g, '');
  const stacked = el.hasAttribute('data-scrim-stacked');
  /* Still on the page a moment later = it was not unmounted (React's development double-run), so nothing leaves. */
  queueMicrotask(() => {
    if (el.isConnected) return;
    const copy = document.createElement('div');
    copy.className = cls;
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('data-scrim-leaving', '');
    if (stacked) copy.setAttribute('data-scrim-stacked', '');
    copy.style.zIndex = z;
    document.body.appendChild(copy);
    fade(copy);
  });
}

function fade(copy: HTMLElement) {
  const ms = scrimFadeMs(getComputedStyle(document.documentElement).getPropertyValue('--sn-scrim-fade'));
  const run = copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
  const done = () => copy.remove();
  run.onfinish = done;
  run.oncancel = done;
  window.setTimeout(done, ms + 100);
}
