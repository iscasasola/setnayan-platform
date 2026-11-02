## 2026-06-28 · feat(vendor): visual map on the public vendor profile

Added a picture-of-the-map with a marker pin above the existing Google Maps /
Waze / Apple Maps "Get directions" chips on `/v/[slug]` (owner 2026-06-28 "do
the visual map image").

- New shared `VendorLocationMap` component (`app/_components/vendor-location-map.tsx`)
  embeds the OFFICIAL OpenStreetMap iframe (`openstreetmap.org/export/embed.html`)
  with a marker — free, no API key, no paid dependency, sanctioned by OSM (not
  bulk tile scraping). A paid static-map API was deliberately avoided (would need
  owner price sign-off). CSP ships only `frame-ancestors 'self'`, so no config
  change was needed.
- Wired into `app/v/[slug]/page.tsx` above `NavLinksRow`. Self-guards: renders
  nothing without coordinates; address-only vendors keep just the existing
  search-fallback chip. Map label uses `location_city` (never the business name)
  so the hidden-vendor name-reveal contract stays intact.

SPEC IMPACT: None — additive UI on an existing public surface. No schema, SKU,
pricing, or data change. Uses already-stored `hq_latitude/hq_longitude`
(auto-geocoded via OSM Nominatim).
