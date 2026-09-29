'use client';

import dynamic from 'next/dynamic';
import { SlotFill } from '../../launch/_components/lazy-slot';

/**
 * ⚡ THE SEAT PLAN'S EDITOR, LOADED WHEN THE SEAT PLAN IS OPENED.
 *
 * The Seat plan page is drawn whole inside the Event Hub Maker (Details › Seat
 * plan, Details part 4), so the Maker's server graph reaches
 * `seating/page.tsx` — and Next puts every `'use client'` module a route's
 * server files import into that route's FIRST LOAD, eagerly. The seating
 * editor (and the live-presence client it brings) was ~95KB gzipped of a Maker
 * opened with Details shut — the Maker went 505KB → 598KB over its ceiling.
 *
 * So the page imports this stand-in — same name, same props — and the editor
 * loads the first time it renders (`launch/_components/details-lazy.tsx`
 * explains the mechanism; `details-pieces-are-lazy.test.ts` holds it). The
 * standalone `/seating` page loads the same way; rendered on the server there,
 * `next/dynamic` preloads the editor's code with the page.
 *
 * 📦 It travels in a chunk group of its OWN, \`maker-seating\` — MEASURED, not
 * guessed. Under \`maker-details\` the standalone \`/seating\` page became a
 * parent of the whole Details group, so every piece Details shares with the
 * Maker's first load was split out into a chunk both loaded up front and
 * lazily — each one an entry in webpack's runtime, which every page loads under
 * the shared-bundle ceiling (\`check-bundle-size.mjs\`): 4,561 B gz. Its own
 * name: 4,523 B, inside the ceiling.
 */
export const SeatingEditor = dynamic(() => import(/* webpackChunkName: "maker-seating" */ './seating-editor').then((m) => m.SeatingEditor), { loading: SlotFill });

/** The same import, asked early (the Maker when idle; the Seat plan row on hover or focus). */
export function prefetchSeating(): Promise<unknown> {
  return import(/* webpackChunkName: "maker-seating" */ './seating-editor');
}
