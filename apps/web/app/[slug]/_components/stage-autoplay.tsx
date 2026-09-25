'use client';

import { useEffect } from 'react';
import { STD_FILM_CLOSE_EVENT, STD_FILM_EXIT_EVENT } from './save-the-date-film';
import { STD_FILM_RETURN_EVENT } from './std-film-handoff';
import { STAGE_SCENE_ANCHOR, stageAutoplaySchedule, stageAutoplaySteps, stageKeyForAnchor } from '@/lib/stage-autoplay';

/**
 * 🎬 AUTO ON THE SAVE THE DATE — the runner for `lib/stage-autoplay.ts`.
 *
 * Mounted by `StdFilmHandoff` for guests and for "Preview the whole stage" —
 * never in the Maker's canvas, where the film is a slide to edit. It does
 * nothing until the film says it has reached its close
 * (`STD_FILM_CLOSE_EVENT`); then it holds the close for one Auto beat, lifts
 * the film (the same `STD_FILM_EXIT_EVENT` "See our page" sends), and brings
 * each following scene into view in the page's order, one Auto beat each.
 *
 * 🤚 THE VIEWER ALWAYS WINS. A touch, a wheel or a key after the close hands the
 * page back and the clock stops — nobody is scrolled away from the calendar
 * button they are reaching for. Reduced motion: no clock at all (the film does
 * not auto-advance either).
 *
 * The scenes are read off the page in DOCUMENT order, which is the navigator's
 * order by construction (both come from `resolveSiteBodyPlan`).
 */
export function StageAutoplay() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let timers: number[] = [];
    let running = false;
    const clear = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
    const takeOver = () => {
      if (!running) return;
      running = false;
      clear();
      detach();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const attach = () => {
      for (const t of ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const) window.addEventListener(t, takeOver, opts);
    };
    const detach = () => {
      for (const t of ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(t, takeOver, opts);
    };

    const sceneKeysOnPage = (): string[] => {
      const ids = Object.values(STAGE_SCENE_ANCHOR).map((id) => `#${id}`).join(', ');
      const keys: string[] = [];
      document.querySelectorAll<HTMLElement>(ids).forEach((el) => {
        const key = stageKeyForAnchor(el.id);
        if (key) keys.push(key);
      });
      return keys;
    };

    const onClose = () => {
      if (running) return;
      running = true;
      clear();
      attach();
      const steps = stageAutoplaySteps(['f:film', ...sceneKeysOnPage()]);
      const schedule = stageAutoplaySchedule(steps);
      schedule.forEach(({ key, at }, i) => {
        timers.push(
          window.setTimeout(() => {
            if (!running) return;
            if (key === 'f:film') return; // the close is on screen now; it lifts when the next scene starts
            if (i === 1) window.dispatchEvent(new CustomEvent(STD_FILM_EXIT_EVENT));
            const id = STAGE_SCENE_ANCHOR[key];
            const el = id ? document.getElementById(id) : null;
            // The lift re-renders the page's visibility first; scroll on the next frame.
            window.requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            if (i === schedule.length - 1) takeOver();
          }, at),
        );
      });
      if (schedule.length <= 1) takeOver();
    };
    const onReturn = () => takeOver();

    window.addEventListener(STD_FILM_CLOSE_EVENT, onClose);
    window.addEventListener(STD_FILM_RETURN_EVENT, onReturn);
    return () => {
      window.removeEventListener(STD_FILM_CLOSE_EVENT, onClose);
      window.removeEventListener(STD_FILM_RETURN_EVENT, onReturn);
      clear();
      detach();
    };
  }, []);

  return null;
}
