'use client';

import { useEffect } from 'react';
import { applyAllSceneRuns } from './part-runs';

/**
 * ✍ HubSceneRuns — lays every scene's runs (one letter, one word in its own
 * font · colour · size) on the guest page, once it is in the browser.
 *
 * A scene's words are drawn by widgets that stay ignorant of the canvas
 * (`every-widget-is-one-section.test.ts`), so its runs cannot be cut into spans
 * server-side the way the hero's are. They ride on the scene's own
 * `<style data-hub-runs>` (`HubCanvasFrame`) and are cut here, by the SAME
 * segmenter the hero uses (`applyAllSceneRuns` → `hubTextSegments`).
 *
 * After hydration, never before: a span laid before React hydrates would be a
 * mismatch. Fail-visible: without this script the scene's words are drawn
 * whole, in the part's own look — every letter there, none wrongly styled.
 *
 * Mounted by `SiteBody` only when some scene on the page has a run.
 */
export function HubSceneRuns() {
  useEffect(() => {
    applyAllSceneRuns(document, document);
  }, []);
  return null;
}
