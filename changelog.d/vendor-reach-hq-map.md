## 2026-07-02 · feat(vendors): coverage-reach map from the HQ address on My Shop

Vendors can now *see* how far they cover. The My Shop → Branch/Locations panel
now renders a map centred on the geocoded HQ (`vendor_profiles.hq_latitude/
hq_longitude`) with a shaded ring at the vendor's tier reach, plus an honest
caption tying it to the couple-facing search behaviour.

**What the ring shows** — the tier reach from `lib/vendor-tier-caps.ts`
`serviceRadiusKm` (the owner-locked ladder, unchanged: Free 0 / Verified 20 /
Solo 20 / Pro 50 / Enterprise 100). This is the SAME number the couple's Services
search gates on (`app/dashboard/[eventId]/vendors/_actions/category-search.ts` ·
"Phase C service-radius gate"), so the vendor now sees exactly the coverage
couples are filtered by. Caption: *"You cover about N km from {city}. Couples
searching farther still find you under 'Show farther,' flagged 'travel fee
likely.'"* Free (unscoped/non-searchable) shows the HQ pin + an upgrade nudge and
no ring; a vendor with no geocoded HQ gets a "add your HQ address" prompt.

**Map implementation** — `app/vendor-dashboard/shop/_components/reach-map.tsx`,
a dependency-free client component. Renders OpenStreetMap raster tiles as plain
`<img>` in a Web-Mercator tile grid centred on the HQ, with an SVG reach ring
whose pixel radius is derived from metres-per-pixel at the HQ latitude; zoom is
auto-picked so the ring fills ~62% of the viewport. No leaflet/react-leaflet dep
(no lockfile change, no client-only SSR dance), and the site CSP is only
`frame-ancestors 'self'` so the tiles load without a policy change. OSM
attribution rendered in-corner per their tile-usage policy. Read-only for now.

SPEC IMPACT: None — purely additive visualization of the EXISTING tier reach
ladder. No SKU/pricing/schema/RLS change; no matchmaking behaviour change (the
ring mirrors the gate that already ships). Follow-ups (logged in the corpus
DECISION_LOG 2026-07-02): (PR-B) make reach vendor-settable up to the tier
ceiling + feed it into the category-search gate and the compat-score distance
decay (which still uses its 25 km fallback) + geocode branches so their circles
map too. Two drifts surfaced for owner sign-off: Enterprise `serviceRadiusKm=100`
is finite yet category-search comments still call Enterprise "∞ / admitted
everywhere"; and `vendor_branches.branch_radius_km` max (200 km) exceeds the
Enterprise tier reach ceiling (100 km).
