'use client';

import { useEffect } from 'react';

/**
 * ServiceIconPlay — plays the animated service icons on a press.
 *
 * Owner, Nov 2026, on the approved service-icons prototype: *"they change color when they are pressed and is
 * selected. then animate to lose the color again"*. Every `svg.si` (`lib/service-icon.ts`) inside the pressed
 * control gets `.go` for 1.3s. The colour comes on at once, its short play runs (`app/service-icons.css`), then
 * the colour fades back.
 *
 * Kept apart from `PressFeel` on purpose. That file is held to ONE listener, no timers and two imports by
 * `lib/the-press-feels-the-same-everywhere.test.ts`. This one does a different job (an icon's own play, not the
 * control's dip), and it needs a timer to end the play.
 *
 * Mounted ONCE, in the root layout. It is one delegated `pointerdown` on the document. A keyboard press
 * (Enter / Space) arrives as a click with no pointer, so `click` with `detail === 0` plays too. Links count:
 * the Explore folder strip's tiles are plain links. Under "reduce motion" the stylesheet shortens the play
 * rather than skipping it (the prototype's choice). Never inside the guest's Event Hub (`.sn-editorial`).
 */
const HOSTS = "a, button, [role='button'], label, summary";
const PLAY_MS = 1300;
const timers = new WeakMap<Element, number>();

export function playServiceIcons(target: Element): void {
  const host = target.closest(HOSTS) ?? target.closest('svg.si');
  if (!host || host.closest('.sn-editorial')) return;
  const icons = host.matches('svg.si') ? [host] : Array.from(host.querySelectorAll('svg.si'));
  for (const icon of icons) {
    icon.classList.remove('go');
    void icon.getBoundingClientRect(); // restarts the play on a second quick press
    icon.classList.add('go');
    const t = timers.get(icon);
    if (t) window.clearTimeout(t);
    timers.set(icon, window.setTimeout(() => icon.classList.remove('go'), PLAY_MS));
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
