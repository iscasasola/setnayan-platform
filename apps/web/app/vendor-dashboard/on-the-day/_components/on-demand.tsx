'use client';

/**
 * ⚡ THE HUB PAGE'S PARTS LOAD ON DEMAND (release blocker, 8 Nov 2026).
 *
 * The Hub page (`../page.tsx`) is also the picked client's Hub body (`clients/[eventId]/_pages/hub.tsx` renders it for
 * one event). So every client part it imports was bundled into the picked client's FIRST load, whichever of the nine
 * pages was on screen (First Load JS of `/vendor-dashboard/clients/[eventId]`: 510 kB, 312 before the nine-page build).
 *
 * Each part below is the SAME component under the SAME name, its code moved to its own chunk with `next/dynamic`
 * (`ssr` on: the server renders it in full and the chunk is preloaded with the HTML, so the Hub page paints and
 * hydrates as before). Inside the picked client the chunk is fetched when Hub is first shown — or earlier, at idle,
 * when the client warms it (`warmHubParts`).
 *
 * 🔒 app/vendor-dashboard/clients/[eventId]/_pages/the-picked-pages-load-their-code-on-demand.test.ts
 */
import dynamic from 'next/dynamic';

export const GuestReviewQr = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './guest-review-qr').then((m) => m.GuestReviewQr), { loading: () => null });
export const ShotList = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './shot-list').then((m) => m.ShotList), { loading: () => null });
export const IssuesLog = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './issues-log').then((m) => m.IssuesLog), { loading: () => null });
export const VendorStatusUpdates = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './vendor-status-updates').then((m) => m.VendorStatusUpdates), {
  loading: () => null,
});
export const ModuleConfigurator = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './module-configurator').then((m) => m.ModuleConfigurator), {
  loading: () => null,
});
export const HubEventMenu = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './hub-event-menu').then((m) => m.HubEventMenu), { loading: () => null });
export const HubThumbRow = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './hub-thumb-row').then((m) => m.HubThumbRow), { loading: () => null });
export const HubSettings = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './hub-settings').then((m) => m.HubSettings), { loading: () => null });
export const AccessGrants = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './access-grants').then((m) => m.AccessGrants), { loading: () => null });
export const CrewPanel = dynamic(() => import(/* webpackChunkName: "hub-parts" */ './crew-panel').then((m) => m.CrewPanel), { loading: () => null });

/** Warm every chunk above (code only — no render, no data). The picked client calls it once its first paint settles. */
export function warmHubParts(): void {
  const warm = [
    () => import(/* webpackChunkName: "hub-parts" */ './guest-review-qr'),
    () => import(/* webpackChunkName: "hub-parts" */ './shot-list'),
    () => import(/* webpackChunkName: "hub-parts" */ './issues-log'),
    () => import(/* webpackChunkName: "hub-parts" */ './vendor-status-updates'),
    () => import(/* webpackChunkName: "hub-parts" */ './module-configurator'),
    () => import(/* webpackChunkName: "hub-parts" */ './hub-event-menu'),
    () => import(/* webpackChunkName: "hub-parts" */ './hub-thumb-row'),
    () => import(/* webpackChunkName: "hub-parts" */ './hub-settings'),
    () => import(/* webpackChunkName: "hub-parts" */ './access-grants'),
    () => import(/* webpackChunkName: "hub-parts" */ './crew-panel'),
  ];
  for (const w of warm) w().catch(() => undefined);
}
