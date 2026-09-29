'use client';

import { useEffect } from 'react';
import { STD_FILM_CLOSE_EVENT, STD_FILM_EXIT_EVENT } from './save-the-date-film';
import { STD_FILM_RETURN_EVENT } from './std-film-handoff';
import {
  STAGE_HOLD_ATTR,
  STAGE_SCENE_ANCHOR,
  STAGE_SCENE_ATTR,
  stageAutoplaySchedule,
  stageAutoplaySteps,
  stageKeyForAnchor,
  stageStops,
  type StageFound,
} from '@/lib/stage-autoplay';

/**
 * 🎬 AUTO ON THE SAVE THE DATE — the runner for `lib/stage-autoplay.ts`.
 *
 * Mounted by `StdFilmHandoff` for guests and for "Preview the whole stage" —
 * never in the Maker's canvas, where the film is a slide to edit. It does
 * nothing until the film says it has reached its close
 * (`STD_FILM_CLOSE_EVENT`); then it holds the close for one Auto beat, lifts
 * the film (the same `STD_FILM_EXIT_EVENT` "See our page" sends), and brings
 * each following scene into view in the page's order, each for its own hold.
 *
 * 🤚 THE VIEWER ALWAYS WINS. A touch, a wheel or a key after the close hands the
 * page back and the clock stops — nobody is scrolled away from the calendar
 * button they are reaching for. Reduced motion: no clock at all (the film does
 * not auto-advance either).
 *
 * The scenes are read off the page in DOCUMENT order, which is the navigator's
 * order by construction (both come from `resolveSiteBodyPlan`): the fixed
 * anchors (`STAGE_SCENE_ANCHOR`) AND every scene `HubScenes` stamped with
 * `data-stage-scene` — the couple's countdown, Love Story, their own scenes —
 * each held for its own canvas clock (`data-stage-hold`). A scene that drew
 * nothing is not a stop; an Auto run is one stop that plays through on its own
 * clock; a Scrub scene is reached through its spacer, so its cross-fade plays
 * under the scroll exactly as it plays under a thumb.
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

    const onClose = () => {
      if (running) return;
      running = true;
      clear();
      attach();
      const stops = stageStops(scenesOnPage());
      const elOf = new Map(stops.map((s) => [s.key, s.el] as const));
      const steps = stageAutoplaySteps(['f:film', ...stops]);
      const schedule = stageAutoplaySchedule(steps);
      schedule.forEach(({ key, at }, i) => {
        timers.push(
          window.setTimeout(() => {
            if (!running) return;
            if (key === 'f:film') return; // the close is on screen now; it lifts when the next scene starts
            if (i === 1) window.dispatchEvent(new CustomEvent(STD_FILM_EXIT_EVENT));
            const el = elOf.get(key) ?? null;
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

/** A section that drew nothing: no box, an empty canvas, or no height (`display: none`). */
function drewNothing(el: Element | null): boolean {
  if (!el) return true;
  if (el.querySelector(':scope > .hub-canvas > .hub-canvas-body:empty')) return true;
  return el.getBoundingClientRect().height <= 0;
}

/**
 * The element a hidden stage marker stands in front of — its next element that
 * is neither another marker nor a scene's own `<style>` (a scene that drew
 * nothing can leave only that behind).
 */
function sectionAfterMarker(marker: Element): Element | null {
  const next = marker.nextElementSibling;
  if (!next || next.hasAttribute(STAGE_SCENE_ATTR) || next.tagName === 'STYLE') return null;
  return next;
}

/** Every scene on the page, in document order, as the pure stop list reads it. */
function scenesOnPage(): StageFound<HTMLElement>[] {
  const ids = Object.values(STAGE_SCENE_ANCHOR).map((id) => `#${id}`);
  const found: StageFound<HTMLElement>[] = [];
  document.querySelectorAll<HTMLElement>([`[${STAGE_SCENE_ATTR}]`, ...ids].join(', ')).forEach((n) => {
    const scene = n.getAttribute(STAGE_SCENE_ATTR);
    if (scene === null) {
      // A fixed anchor (the names, the entourage, the story) — as before.
      const key = stageKeyForAnchor(n.id);
      if (key) found.push({ key, el: n, drew: true });
      return;
    }
    const hold = Number(n.getAttribute(STAGE_HOLD_ATTR));
    const holdMs = Number.isFinite(hold) && hold > 0 ? hold : undefined;
    if (n.hasAttribute('hidden')) {
      // A hidden marker in front of its scene (this page has no scene wrappers).
      const section = sectionAfterMarker(n);
      found.push({ key: scene, el: (section as HTMLElement | null) ?? n, drew: !drewNothing(section), holdMs });
      return;
    }
    // Otherwise the scene's own wrapper (`.hub-scene`) carries the mark.
    const run = n.parentElement;
    if (run && run.classList.contains('hub-arun') && run.hasAttribute('data-armed')) {
      // One screen, one clock: the run's FIRST scene sets it (`groupSceneRuns`).
      const runHold = Number(run.querySelector(`:scope > [${STAGE_HOLD_ATTR}]`)?.getAttribute(STAGE_HOLD_ATTR));
      const live = run.querySelectorAll(':scope > .hub-auto:not([data-auto-skip])').length;
      found.push({
        key: scene,
        el: n,
        drew: !drewNothing(n),
        holdMs: Number.isFinite(runHold) && runHold > 0 ? runHold : holdMs,
        run: { el: run, live },
      });
      return;
    }
    // A pinned (Scrub) scene is driven by the spacer after it: scrolling THAT
    // is what hands it over.
    const spacer = n.classList.contains('hub-scrub') ? n.nextElementSibling : null;
    const target =
      spacer instanceof HTMLElement && spacer.classList.contains('hub-sp') && spacer.offsetHeight > 0 ? spacer : n;
    found.push({ key: scene, el: target, drew: !drewNothing(n), holdMs });
  });
  return found;
}
