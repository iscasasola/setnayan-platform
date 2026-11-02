## 2026-07-02 · feat(vendors): inline branch add with drop-pin + auto city + auto range

Adding a branch no longer jumps to a separate page (owner 2026-07-02). My Shop →
Branch panel now has an **Add a branch** expander with the full flow inline:
branch name → **drop a pin on a map** (drag the map, crosshair pin) → the **city
is auto-detected** by reverse-geocoding the pin → the **range is automatic**
(inherits the Enterprise tier reach, no manual radius input) → pick BDO/GCash →
**Purchase ₱999 / 28 days** (apply-then-pay; a Setnayan admin confirms and the
branch activates). No documents are required per branch — a branch inherits the
org's verification, and the admin already reviews it at payment (owner decision
2026-07-02).

**One shared surface.** The whole add + manage experience is a single
`BranchManager` client component rendered BOTH inline in My Shop and on the
existing `/vendor-dashboard/branches` page (kept — it's a lint-guarded nav
destination), so the two never drift and the drop-pin add works in both places.

**Schema** (migration `20270430989880_vendor_branch_geocode_coords.sql`) — adds
nullable `branch_latitude` / `branch_longitude` / `branch_address` to
`vendor_branches`. RLS unchanged (new columns on the existing owner/admin-managed
table). Legacy typed-city branches keep working with NULL coords.

**Map** — dependency-free `BranchPinMap` (`vendor-dashboard/_components/`):
OpenStreetMap raster tiles as `<img>` in a Web-Mercator grid with pan + zoom and
a fixed centre-crosshair pin (Grab/Uber pattern — no click-vs-drag ambiguity).
Inverse-Mercator converts the pan delta back to a lat/lng on pointer-up. Same
approach as the coverage ReachMap (no leaflet dep; CSP `frame-ancestors 'self'`
allows the tiles; OSM attribution in-corner).

**Actions** — `branches/actions.ts` refactored from redirect-style to
return-based (`useActionState`) so both surfaces settle add/renew/cancel in place
with a toast, no page jump. New `detectBranchLocation(lat,lng)` reverse-geocode
action (gated to a branch manager so it isn't an open geocoding proxy). Range is
set server-side via `branchAutoRadiusKm()` (Enterprise tier reach, clamped to the
column max) — a submitted radius is ignored. Coords are stored as a pair or not
at all; the branch still rolls back if the payment row fails.

SPEC IMPACT: net-new `vendor_branches` columns (lat/lng/address) + a new
`reverseGeocodeNominatim` geo helper; no SKU/pricing change (branch fee stays the
admin-managed ₱999/28d, Enterprise-only). Branch verification policy: inherits
org verification, no per-branch documents (owner 2026-07-02). Logged in corpus
DECISION_LOG 2026-07-02.
