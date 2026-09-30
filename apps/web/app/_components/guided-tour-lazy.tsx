'use client';

import dynamic from 'next/dynamic';

/**
 * 🥗 THE WELCOME TOURS LOAD WHEN ONE IS SHOWN (rd/maker-diet, 2026-09-30).
 *
 * A server layout or page that imports `guided-tour.tsx` puts it — and every
 * tour's copy in `lib/tours.ts` — into that route's first load, eagerly, even
 * though a tour draws only for someone who has not seen it yet (`MiniTour`,
 * the couple welcome). So the server files import THIS stand-in, with the same
 * name and props, and the tour's code arrives the first time it renders. On a
 * first visit the server renders it and `next/dynamic` preloads its code with
 * the page, so the tour opens exactly as before.
 *
 * Unnamed on purpose: a chunk NAME is one more entry in the webpack runtime
 * every page downloads (`maker-shell.tsx`'s note; `check-bundle-size.mjs`).
 * 🛡 `the-tour-is-not-in-the-first-load.test.ts`.
 */
export const GuidedTour = dynamic(() => import('./guided-tour').then((m) => m.GuidedTour));
