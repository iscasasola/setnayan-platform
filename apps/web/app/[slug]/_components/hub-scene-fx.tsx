'use client';

import { useEffect } from 'react';
import { HUB_SCENE_FX_ATTR, readHubSceneRuns } from '@/lib/element-style';
import { applySceneFx } from './part-fx-cut';

/**
 * ✨ HubSceneFx — a scene's Word by word · Spread · Glow, cut into its words on the guest page (owner 2026-10-17,
 * "extend the effects to every text and picture part"). A scene's words are drawn by widgets that stay ignorant of the
 * canvas (`every-widget-is-one-section.test.ts`), so — as its runs are — they are cut in the browser, by the SAME cutter
 * the cover's server render and the Maker's preview use (`lib/part-fx.ts`), from the scene's own
 * `<style data-hub-word-fx>` (`hubSceneFxAttr`).
 *
 * ⏳ WHEN: as the scene nears the screen — the moment the page's one observer marks it `.pahina-in`
 * (`pahina-motion.tsx`, 32 px before it enters) — so the first frame a guest sees is the arrival's first frame. A scene
 * already on the screen when the page lands is cut AT REST (`late`): never drawn, taken away and brought in again.
 * Fail-visible: without this script the words are drawn whole, in the part's own look.
 *
 * Rendered by the scene's own frame right after its style (`HubCanvasFrame`, `PostEventSceneFrame`); draws nothing.
 */
export function HubSceneFx({ scope }: { scope: string }) {
  useEffect(() => {
    const stops: Array<() => void> = [];
    document.querySelectorAll(`style[data-hub-els="${CSS.escape(scope)}"][${HUB_SCENE_FX_ATTR}]`).forEach((tag) => {
      const scene = tag.previousElementSibling as HTMLElement | null;
      if (!scene) return;
      const elements = readHubSceneRuns(tag.getAttribute(HUB_SCENE_FX_ATTR));
      const cut = (late: boolean) => applySceneFx(scene, elements, document, { late });
      const armed = document.documentElement.classList.contains('pahina-js');
      if (!armed || scene.classList.contains('pahina-in')) {
        const r = scene.getBoundingClientRect();
        cut(r.top < window.innerHeight && r.bottom > 0);
        return;
      }
      const mo = new MutationObserver(() => {
        if (!scene.classList.contains('pahina-in')) return;
        mo.disconnect();
        cut(false);
      });
      mo.observe(scene, { attributes: true, attributeFilter: ['class'] });
      stops.push(() => mo.disconnect());
    });
    return () => stops.forEach((s) => s());
  });
  return null;
}
