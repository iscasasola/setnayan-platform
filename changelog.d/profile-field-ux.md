# Changelog fragment — collected into CHANGELOG.md at release

## 2026-07-03 · feat(vendor-shop): inline field UX — direct text boxes on blank fields + OSM map-pin HQ address picker

Lane C of the My Shop profile+verification redesign, confined to the inline
Business-Profile field editor.

**Part 1 — direct text boxes on blank fields (owner: "text boxes if blank, edit
buttons if with content"):** a BLANK plain field (Shop name, Business owner,
Contact number, Company email, EST) now renders its input directly in the row
body — no "Add" click needed. It saves on blur only when the value actually
changed (reuses the existing dirty tracking + `updateVendorProfileField`); Enter
saves, Esc reverts. Once saved, the row flips to the normal value + Edit
behavior ("text box gone when done"). Filled fields, and composite editors
(logo upload, services picker, company address) keep the expand-to-edit flow
unchanged; an inline input is not "open" in the one-open-at-a-time sense, so
typing in one never collapses an expanded editor.

**Part 2 — Company address becomes an OSM/Leaflet map-pin picker (owner:
"company address has mapping so we can have an exact pin of their HQ"):** the
expanded Company-address editor keeps the address text input (server contract
unchanged) and adds a compact Leaflet map (OpenStreetMap tiles, © OSM
attribution). "Find on map" geocodes the typed address client-side via the
Nominatim public API (identified per usage policy; ≤1 req/s debounce; friendly
zero-result note); the vendor drags the pin or clicks the map to the exact HQ
spot, with a mono lat/lng readout. On save the pin rides along as hidden
`hq_latitude`/`hq_longitude` inputs; `updateVendorProfileField`'s `maps_pin`
case saves valid posted coords directly and skips the server re-geocode (the
hand-placed pin is more precise). Absent coords keep today's server geocode
path byte-identical. Leaflet loads via dynamic import on mount (never SSR),
uses `L.divIcon` to sidestep the bundler marker-icon breakage, and
`invalidateSize()`s via ResizeObserver so the map renders correctly inside the
animated Collapsible. New deps: `leaflet` + `@types/leaflet`. No CSP change
needed (the app's CSP only sets `frame-ancestors`). No migration —
`hq_latitude`/`hq_longitude` already exist on `vendor_profiles`.

SPEC IMPACT: None (implements the owner-approved 2026-07-03 My Shop field-UX
direction; no price/SKU/schema change).
