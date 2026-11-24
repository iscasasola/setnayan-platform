# Maps and connections audit (24 Nov 2026)

> READ-ONLY audit. Owner, 23 Nov: "connect all maps and connections to the database, if any."
> This lane only finds problems and groups them into fix batches. No app code is changed here.

STATUS: building. Pass 1 (maps) is written below; passes 2 and 3 follow.

## Pass 1 · Maps

| ID | area | route | file:symbol | what it shows now | real value already lives in | severity | fix |
|---|---|---|---|---|---|---|---|
| MAP-1 | couple · guest | `/[slug]` Venue scene · `/dashboard/[eventId]/launch` Details › Venues · Find distance chips | `lib/events.ts:recomputeReceptionAnchor` (callers: `app/(shell)/explore/actions.ts`, `app/onboarding/wedding/actions.ts`, `app/dashboard/[eventId]/vendors/actions.ts`, `lib/vendor-couple-invite.ts`) | Writes `events.venue_latitude/longitude` from a shop's HQ when the reception is only shortlisted (`source: 'considering'`), keeps that pin after the pick is removed ("leaves the existing anchor untouched"), and never uses the couple's own hand-added reception pin. The same columns are the couple's own pin (Details › Venues, `hub-draft.ts`) and the Event Hub's reception when nothing is booked (`lib/event-venues.ts:resolveEventVenues`). A guest can be routed to a venue the couple only looked at. | Couple's pin: `events.venue_latitude/longitude` (hub-draft apply). Distance anchor: computed at read by `resolveReceptionAnchor`. Hand-added venue pin: `event_manual_vendors.address_latitude/longitude`. | wrong data | M |
| MAP-2 | couple · guest | `/dashboard/[eventId]` (Home countdown, day-of times) · `/[slug]/print` · Papic capture windows | `events.timezone` readers: `lib/home-facts.ts:homeFacts`, `app/dashboard/[eventId]/page.tsx`, `app/[slug]/print/page.tsx:printedStampLine`, Papic RPCs (`e.timezone`) | `events.timezone` has **no writer**: it is always its default `'Asia/Manila'`. The Event Hub instead derives the zone from the venue pin (`lib/event-timezone.server.ts:eventTimezoneFromCoords`). Two clocks for one event once the venue is outside UTC+8. | `events.timezone` (exists, NOT NULL); the zone rule is `lib/venue-zone.ts:venueZoneFromCoords` | wrong data | S |
| MAP-3 | guest | `/[slug]/find-my-table` | `app/[slug]/find-my-table/page.tsx:resolveEntrance` | Reads only the legacy `events.venue_entrance_x/y`, which nothing writes since the blueprint editor moved (held by `lib/one-door-one-answer.test.ts`). The walking route starts at the default bottom-centre door, not the door the couple placed. Its comment says `fetchEntrance` needs the RLS client; it takes any client (`/[slug]/seat` passes admin). | `event_floor_plan.entrance_enabled/entrance_x/entrance_y` via `lib/indoor-blueprint.ts:fetchEntrance` | wrong data | S |
| MAP-4 | supplier | `/vendor-dashboard/shop` (Company address) → `/v/[slug]` map, couples' venue pins | `app/vendor-dashboard/actions.ts` `case 'hq_address'` + the follow-up `geocodeNominatim` update | A new address typed without re-pinning, whose geocode misses, keeps the **old** `hq_latitude/longitude` ("Admin-supplied coords aren't clobbered on a miss") and the save says nothing. The shop map, every couple venue that follows this shop's pin, and distance chips stay on the old place. The follow-up `update` drops its `error`. | `vendor_profiles.hq_latitude/longitude` (the editor already has the map to place it) | wrong data | S |
| MAP-5 | couple · supplier | `/onboarding/wedding` · Details city pick · Suppliers place sheet · `/dashboard/create-event` · supplier landing | `app/onboarding/wedding/_data/wedding-cities.ts:CITIES/TOP30/REGION_CENTROID`; `lib/region-source.ts` static table (`hydrateRegionsFromRows` is never called) | City list, Top-30 order, nuggets, coordinates and region centres are TS literals used by about 12 files. Identical to the seed today; an admin edit to either table changes nothing on screen. `wedding_destinations` has no app reader at all. | `wedding_destinations` (`lat`, `lon`, `rank`, `nugget`, `photo_key`, `region_code`); `regions.centroid_lat/centroid_lon` | look (drift) | L |
| MAP-6 | couple · supplier | every pin map before a pin exists | `app/dashboard/[eventId]/_components/address-pin-field.tsx:PH_FALLBACK` · `app/vendor-dashboard/shop/_components/editable-row.tsx:PH_FALLBACK` · `app/vendor-dashboard/shop/_components/branch-panel.tsx:branchMapCenter` · `app/open-shop/_components/city-pin.tsx:DEFAULT_CENTER` · `app/onboarding/wedding/_components/wedding-venues.tsx` (`center`) · `app/onboarding/wedding/_components/location-step.tsx:NCR_FALLBACK` · `app/dashboard/[eventId]/launch/_components/details-city-pick.tsx:NCR_FALLBACK` | Seven hand-typed Manila centres. A couple in Cebu opens an unpinned venue map over Manila even though `events.region` says Cebu. | `events.region` → `lib/region-source.ts:regionCentroid` (`regions.centroid_lat/lon`); supplier: `vendor_profiles.location_city` | look | S each |
| MAP-7 | supplier | `/vendor-dashboard/shop` (Company address) · `/open-shop` | `app/vendor-dashboard/shop/_components/editable-row.tsx:HqAddressControl` · `app/open-shop/_components/city-pin.tsx` | A second pin-picker engine (Leaflet) beside the shipped `BranchPinMap`. The shop editor also calls Nominatim straight from the browser (a personal contact address in the query string), skipping the rate-limited server proxy, and the report-only CSP `connect-src` does not list that host: the day the policy is enforced, "Find on map" fails silently. | `app/vendor-dashboard/_components/branch-pin-map.tsx:BranchPinMap` + `app/open-shop/city-actions.ts:locateShopAddress` | look | M |
| MAP-8 | couple · supplier | appointment cards (`AppointmentsSection`) | `app/_components/appointments-section.tsx:directionsUrl` | Builds its own Google Maps search link. `lib/map-directions.ts` names `nav-links.tsx` (`DirectionsMenu`) as the one builder, so appointments get no Android chooser, Waze or Apple Maps. | `app/_components/nav-links.tsx:DirectionsMenu` / `lib/geo.ts:googleMapsSearchByQuery` | look | S |

**Checked and found wired (no finding):** the guest Hub's venue maps (`lib/event-venues.ts:loadVenueBookings` reads `event_manual_vendors`, `venue_directory`, `vendor_profiles.hq_*`; a refused read falls back to the event's own columns and is logged) · hand-added supplier pin (`AddressPinField` → `workspace/actions.ts` → `event_manual_vendors.address_*`, pre-filled back) · supplier branch pins (`branches/actions.ts`, both-or-neither) · open-shop signup pin (`open-shop/actions.ts`, `parseCoordPair`) · service radius (`shop/radius-actions.ts` → `inner/outer_radius_km`, read by Suppliers, category search, area counts, public shop) · public shop map, ring and branch line (`app/v/[slug]/page.tsx`) · Get directions sheet (`lib/map-directions.ts`).

**Rejected on purpose:** `papic_photos.geo_*` are write-only by design (privacy control, never returned) · `vendor_ad_subscriptions.radius_km` has no writer or reader and is already in `tests/db/ugat-both-ends.baseline.txt` · branch radius is the constant `BRANCH_RADIUS_MAX_KM` by owner ruling 19 Nov ("range is automatic") · `platform_settings.drive_speed_kmh` is admin-set and read honestly (`fetchDriveSpeed`).

## How to re-run the scans

The helpers under `scripts/audit/` touch no database, no network and no app file. Each prints candidates; only what is in the tables above was confirmed by reading the code.

```bash
node scripts/audit/location-columns.mjs
```

```bash
node scripts/audit/dropped-read-errors.mjs --area app/dashboard
```

```bash
node --experimental-strip-types --no-warnings scripts/audit/dead-paths.mjs
```
