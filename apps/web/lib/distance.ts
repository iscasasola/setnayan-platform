/**
 * Distance helpers — thin re-export surface for `haversineKm` + `formatDistanceKm`
 * from `lib/geo.ts`.
 *
 * WHY a separate file when `lib/geo.ts` already exports both?
 *
 * The 2026-05-22 vendor-card-quickview brief explicitly asked for
 * `apps/web/lib/distance.ts` with `haversineKm(lat1, lng1, lat2, lng2)` returning
 * kilometers. Naming the module after the concept (distance) instead of the
 * crate (geo) makes the import sites read cleaner at call sites that only need
 * the Haversine math without the Nominatim geocoder + the rest of `lib/geo.ts`.
 *
 * Both functions are re-exported as-is — no behavior change, no second math
 * pass. Editing the implementation in `lib/geo.ts` updates this surface too
 * since these are direct re-exports, not copies.
 *
 * If callers ever need a richer distance API (chained from-to-via, road
 * distance, time-of-day adjusted ETA), grow this file and let `lib/geo.ts`
 * keep its narrower "geographic primitives" scope.
 */

export { haversineKm, formatDistanceKm } from './geo';
