'use client';

/**
 * front-door-lazy.tsx — the front door's SIGNED-IN-ONLY client pieces, loaded only when they are drawn.
 *
 * ⚡ WHY (measured 2026-11-13, production build, Lighthouse mobile from `.lighthouserc.json`). Every `'use client'`
 * module that `app/page.tsx`'s SERVER tree imports joins the page's entry chunk group, and Next writes that whole
 * group into the HTML of `/` — whether or not the component is rendered. So a stranger opening the front page
 * downloaded the signed-in search's "Add your own" walk (the dashboard's add-a-supplier flow: send-invite, the
 * supplier-connect panel, the address pin map, form rows — ~34KB gzipped over six chunks) and Discover's signed-in
 * thumb row (~10KB), neither of which the signed-out page ever draws. Lantern (Lighthouse's simulator) counts every
 * byte requested before the LCP, so they sat directly on the front page's mobile LCP.
 *
 * `next/dynamic` keeps them SERVER-RENDERED exactly as before (`ssr` is on by default): when a page draws one, its
 * HTML is the same and its chunk is preloaded with the page; when a page does not draw it, nothing is fetched.
 * Same components, same props, same markup.
 *
 * 🛡 `app/_components/frontdoor/the-front-page-ships-only-what-it-draws.test.ts`.
 */
import dynamic from 'next/dynamic';

/** "＋ Add “…” as your own supplier" — Discover's signed-in search, when nothing matched. */
export const DiscoverAddOwn = dynamic(() => import('./discover-add-own').then((m) => m.DiscoverAddOwn));

/** Discover's own search row — signed in only (the top bar carries the search signed out). */
export const DiscoverThumbRow = dynamic(() => import('./shell-thumb-rows').then((m) => m.DiscoverThumbRow));
