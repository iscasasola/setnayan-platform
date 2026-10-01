import { TOURS } from '@/lib/tours';
import { tourSlideView, type TourSlideView } from '@/app/_components/tour-slide-view';
import { MAKER_TOUR_KEY } from './maker-bar';

/**
 * The tour slides this viewer is shown — pure, so a test can hold both rules.
 *
 *   · In the app-store shell a slide that SELLS is dropped outright (App Review
 *     3.1.1: no digital price and no paid pitch inside the app).
 *   · Elsewhere its `{price}` token becomes " — ₱X, once" from the live
 *     catalogue, or nothing at all when the catalogue did not answer. A
 *     remembered number is never printed.
 *
 * ⚡ SERVER ONLY (the diet, 2026-10-01). It lived in `maker-bar.ts`, which the
 * client shell imports, so `lib/tours.ts` — every tour's words — rode the
 * Maker's first load. The launch page builds the slides here and hands the
 * shell `makerTourSlideViews(…)`; the carousel never sees TOURS.
 */
export function makerTourSlides(input: { storeShell: boolean; priceLabel: string | null }) {
  return TOURS[MAKER_TOUR_KEY].slides
    .filter((s) => !(input.storeShell && s.sells))
    .map((s) => ({
      ...s,
      body: s.body.replace('{price}', input.priceLabel ? ` &mdash; ${input.priceLabel}, once` : ''),
    }));
}

/** The same slides, drawn for the client carousel (`maker-tour.tsx`). */
export function makerTourSlideViews(input: { storeShell: boolean; priceLabel: string | null }): TourSlideView[] {
  return makerTourSlides(input).map(tourSlideView);
}
