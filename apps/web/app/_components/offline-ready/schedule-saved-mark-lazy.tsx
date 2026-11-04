'use client';

import dynamic from 'next/dynamic';

/**
 * ⚡ THE SCHEDULE'S SAVED MARK, LOADED WITH THE SCHEDULE — never in the Event Hub Maker's first load.
 *
 * The Maker draws the Schedule page whole (`launch/page.tsx` imports `schedule/page.tsx`), and Next puts every
 * `'use client'` module a route's server files import into that route's first load, drawn or not
 * (`launch/_components/details-pieces-are-lazy.test.ts` explains it; `scripts/check-maker-js-budget.mjs` holds the
 * ceiling). The mark is never drawn inside the Maker, so the Schedule page imports this stand-in — same name, same
 * props — and the mark's code loads the first time it renders. On the standalone Schedule it is rendered on the server
 * as before (its `data-sn-copy-version` is in the page's HTML), and `next/dynamic` preloads its code with the page.
 *
 * Named into the Schedule's own chunk group (`maker-schedule`, as `schedule-lazy.tsx`): an unnamed `import()` would be
 * one more async chunk, and one more entry in webpack's runtime, which every page loads (`check-bundle-size.mjs`).
 */
export const ScheduleSavedMark = dynamic(
  () => import(/* webpackChunkName: "maker-schedule" */ './schedule-saved-mark').then((m) => m.ScheduleSavedMark),
  { loading: () => null },
);
