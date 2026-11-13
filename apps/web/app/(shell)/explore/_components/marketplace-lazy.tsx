'use client';

/**
 * marketplace-lazy.tsx — the supplier view's heaviest client pieces, fetched only when the supplier view is drawn.
 *
 * ⚡ WHY (measured 2026-11-13, production build, Lighthouse mobile from `.lighthouserc.json`). `MarketplaceView` is
 * rendered by the front page only when a supplier parameter is on `/` (`front-door.tsx` imports it with a server-side
 * `await import()`), but every `'use client'` module its server code imports still joins the FRONT PAGE's entry
 * chunk group — and Next writes that whole group into the HTML of every `/`. So each stranger opening the front page
 * downloaded the sticky supplier header with its filter drawer and typing band (~27KB gzipped) and the folder strip's
 * map of 268 lucide icons (~24KB gzipped) for a view they had not opened.
 *
 * `next/dynamic` keeps them SERVER-RENDERED exactly as before (`ssr` stays on): with a supplier parameter the HTML is
 * the same and their chunks are preloaded with the page; without one, nothing is fetched. Same components, same
 * props, same markup. 🛡 app/_components/frontdoor/the-front-page-ships-only-what-it-draws.test.ts.
 */
import dynamic from 'next/dynamic';

export const StickyMarketplaceHeader = dynamic(() =>
  import('./sticky-marketplace-header').then((m) => m.StickyMarketplaceHeader),
);
export const IconTileFolderStrip = dynamic(() => import('./icon-tile-folder-strip').then((m) => m.IconTileFolderStrip));
export const VendorsAvailabilityBanner = dynamic(() =>
  import('./vendors-availability-banner').then((m) => m.VendorsAvailabilityBanner),
);
export const EventTypeNotifyForm = dynamic(() => import('./event-type-notify-form').then((m) => m.EventTypeNotifyForm));
