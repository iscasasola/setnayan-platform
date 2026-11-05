/**
 * prints-slides.test-helper.ts — read what each print hands its slide of the Prints carousel, and draw the carousel from it
 * (owner 2026-10-26, DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL"; `studio-prints-carousel.tsx`).
 *
 * A print's part no longer draws a row: it REGISTERS its slide (`useRegisterSlide`, `prints-view-store.ts`) from an effect — which a
 * pure render never runs. `captureSlidesForTest(true)` makes the render write it too; this helper turns the seam on, renders the
 * given editors (their lazy pieces settled), reads the merged slides, and can then draw the carousel itself at any slide — the
 * same markup a phone gets.
 */
import React from 'react';
import { renderSettled } from './render-settled.test-helper';

const L = 'app/dashboard/[eventId]/launch/_components';

export type SlideItem = { key: string; label: string; group: 'set' | 'day' | 'download' };

/** Render `nodes` with the seam on and return every slide they registered (the store is emptied first). */
export async function slidesOf(nodes: readonly React.ReactNode[]) {
  const store = await import(`../${L}/prints-view-store`);
  store.captureSlidesForTest(false);
  store.captureSlidesForTest(true);
  for (const n of nodes) await renderSettled(React.createElement(React.Fragment, null, n));
  return store.printSlidesNow() as ReadonlyMap<string, import('../app/dashboard/[eventId]/launch/_components/prints-view-store').PrintSlide>;
}

/** The carousel's markup, opened on `at`, drawn from what `slidesOf` registered (call it right after). */
export async function carouselAt(items: readonly SlideItem[], at: string): Promise<string> {
  const { StudioPrintsCarousel } = await import(`../${L}/studio-prints-carousel`);
  return renderSettled(React.createElement(StudioPrintsCarousel as never, { items, at, onSelect: () => {} } as never));
}

/** Turn the seam off again (and empty the store) — every test that turned it on ends with this. */
export async function endSlides() {
  const store = await import(`../${L}/prints-view-store`);
  store.captureSlidesForTest(false);
}
