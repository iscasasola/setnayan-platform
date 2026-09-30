import { TOURS } from '@/lib/tours';
import { MAKER_TOUR_KEY } from './maker-bar';

/*
 * 🥗 The Maker tour's slide filter lives HERE, not in `maker-bar.ts` (rd/maker-diet,
 * 2026-09-30). The bar is in the Maker's first load; the tour draws only on a first
 * visit or "About the Maker", and it loads on demand (`maker-shell.tsx`). While this
 * sat in `maker-bar.ts` it pulled EVERY tour's copy (`lib/tours.ts`) into the code a
 * phone downloads before its first tap. Still a plain module, never `'use client'`
 * (see the 🔴 note in `maker-tour.tsx`).
 */

/**
 * The tour slides this viewer is shown — pure, so a test can hold both rules.
 *
 *   · In the app-store shell a slide that SELLS is dropped outright (App Review
 *     3.1.1: no digital price and no paid pitch inside the app).
 *   · Elsewhere its `{price}` token becomes " — ₱X, once" from the live
 *     catalogue, or nothing at all when the catalogue did not answer. A
 *     remembered number is never printed.
 */
export function makerTourSlides(input: { storeShell: boolean; priceLabel: string | null }) {
  return TOURS[MAKER_TOUR_KEY].slides
    .filter((s) => !(input.storeShell && s.sells))
    .map((s) => ({
      ...s,
      body: s.body.replace('{price}', input.priceLabel ? ` &mdash; ${input.priceLabel}, once` : ''),
    }));
}

