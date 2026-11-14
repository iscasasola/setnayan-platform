## 2026-11-14 · fix(maps): map card follow-ups from the live re-walk of #7682

- **Apple Maps drops a named pin and offers the route.** `appleMapsUrl(lat, lng, name?)` (lib/geo.ts) now builds
  `https://maps.apple.com/?daddr=<lat>,<lng>&q=<name>` instead of the centre-only `?ll=`. Its one caller, the Get
  directions sheet (`DirectionsMenu`, nav-links.tsx), passes the place's name (a venue's name; never a supplier's —
  a supplier page hands in no name, so its link is the route alone).
- **The supplier page's reach-ring map is the map card.** `ReachMap` takes `card` (9 : 5, never taller than 250 px,
  like `MapCard`); the public `ShopReachMap` passes it, keeping the © OpenStreetMap tag and the round bigger-map button
  (OSM at the shop pin; none on the sample page). The supplier's own Where you work map keeps its 240 px.
- **No "Where" for a shop with nowhere to show.** `shopHasWhere` (lib/shop-page-plan.ts) decides the calm look's Where
  tab AND its section together: no pin, no address and no city → neither is drawn. (app/v/[slug]/page.tsx: one const and
  two conditions.)
- **The host sees their own venue.** The invitation page's shared props go through `venueForViewer` with the page's
  own `ownerCapability` (not on the Maker canvas, a See as sample or a guest pass the host opened): address, map and Get
  directions. Unreplied guests still get none of it; See as samples are closed again explicitly.
  `the-venue-opens-after-the-reply.test.ts`'s page guard was updated to state the new design (host opens, sample
  closes, one guest opener) and a test executes both sides.

SPEC IMPACT: None
