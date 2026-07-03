'use client';

/**
 * GlobalSliderHint — app-wide "drag me" affordance for line sliders (owner
 * 2026-07-03, "the knobs of the line bar toggles should shake left-right when
 * no one is touching them, so users understand it moves").
 *
 * One app-wide client effect (mirroring GlobalHaptics) rather than per-slider
 * wiring: it adds the `.sn-shake` class — a small periodic left↔right knob
 * wiggle defined in globals.css — to every opted-in slider, and removes it the
 * instant that slider is touched (a knob the user has already grabbed doesn't
 * need the hint). A slider opts in with class `sn-range` (native-thumb sliders
 * that also get the shared brand knob) or `data-sn-hint` (already-custom-thumb
 * sliders — pricing calculator, onboarding pax/budget — that keep their look).
 *
 * A MutationObserver re-scans for sliders mounted later (the comparator and
 * pricing sliders live in on-demand overlays; onboarding steps mount lazily),
 * coalesced to one pass per frame so it stays as light as GlobalHaptics.
 *
 * Accessibility: under prefers-reduced-motion the class is never added (and the
 * universal freeze block in globals.css would neutralise it anyway). The
 * media-query `change` listener starts/stops it live, mirroring GlobalHaptics.
 */

import { useEffect } from 'react';

const SEL = 'input[type="range"].sn-range, input[type="range"][data-sn-hint]';

export function GlobalSliderHint() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const addAll = () => {
      if (mq.matches) return;
      document.querySelectorAll<HTMLInputElement>(SEL).forEach((el) => {
        if (el.dataset.snTouched !== '1') el.classList.add('sn-shake');
      });
    };
    const removeAll = () => {
      document
        .querySelectorAll<HTMLElement>('.sn-shake')
        .forEach((el) => el.classList.remove('sn-shake'));
    };

    // Coalesce observer bursts. setTimeout (not requestAnimationFrame): rAF is
    // paused entirely while the tab is hidden, so a slider mounted in a
    // background tab would never get the hint until focus — setTimeout still
    // fires (throttled) and catches it.
    let timer = 0;
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        addAll();
      }, 80);
    };

    // First interaction with a slider = the user gets it — stop hinting THAT
    // one, permanently for this page load.
    const stop = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null;
      if (!el) return;
      el.dataset.snTouched = '1';
      el.classList.remove('sn-shake');
    };

    const onMq = () => {
      if (mq.matches) removeAll();
      else addAll();
    };

    addAll();
    document.addEventListener('pointerdown', stop, { capture: true, passive: true });
    document.addEventListener('keydown', stop, { capture: true });
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    mq.addEventListener('change', onMq);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('pointerdown', stop, { capture: true } as EventListenerOptions);
      document.removeEventListener('keydown', stop, { capture: true } as EventListenerOptions);
      obs.disconnect();
      mq.removeEventListener('change', onMq);
    };
  }, []);

  return null;
}
