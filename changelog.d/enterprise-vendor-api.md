## 2026-07-11 · feat(api): Enterprise Vendor API — api_access grant + /api/v1/vendor read endpoints

Tightened the `/api/v1` SDK gate from "any active Enterprise vendor" to an
EXPLICIT per-Custom-plan `api_access` entitlement (owner 2026-07-11: "available
if custom plan of enterprise requests allowing api"), and shipped the first
vendor-scoped read surface.

**Entitlement gate.** Added an optional `api_access: boolean` to
`vendor_custom_plans.composition` (mirrors the existing `domain` toggle; a free
entitlement, NOT priced in `computeCustomQuote` — it rides in the negotiated
Custom quote). An admin ticks "API access" while composing a Custom plan
(`/admin/custom-plans`). New `resolveApiVendor()` / `userHasApiAccessGrant()`
(`lib/enterprise-vendor-gate.ts`) require: user OWNS an active (non-lapsed)
enterprise-or-above vendor AND that vendor has an ACTIVE custom plan with
`composition.api_access === true`. Fail-closed on any error/missing flag.
`authenticateApiRequest` now enforces this (replacing the raw-tier check),
resolves the blessed `vendorProfileId` ONCE, and carries it on `ApiAuthResult`
so vendor routes never re-derive it. Mint-gate + upsell copy on
`/dashboard/api-keys` swapped to the same grant check. New auth error
`no_api_access` (403). Prod was a clean slate (0 keys / 0 enterprise-or-custom
vendors / 0 active custom plans), so the tightening breaks nothing live.

**Read endpoints** (each scoped to the caller's own shop via the admin client +
explicit `vendorProfileId` filter, hand-picked column allowlists, never `*`):

- `GET /api/v1/vendor/profile` (`vendor.profile.read`) — own profile + services +
  packages. Excludes tax/BIR identifiers, precise HQ geo, moderation flags, R2 keys.
- `GET /api/v1/vendor/leads` (`vendor.leads.read`) — active inquiries (pending/
  accepted): status, event DATE, pax, requested services. No couple contact, no venue.
- `GET /api/v1/vendor/bookings` (`vendor.bookings.read`) — confirmed bookings
  (contracted+). Hard-excludes every money column, notes, contact, deposit proof.
- `GET /api/v1/vendor/availability` (`vendor.availability.read`) — windowed calendar
  blocks + day states. Strips block labels + client PII; `setnayan_booking_id` → boolean.
- `GET /api/v1/vendor/reviews` (`vendor.reviews.read`) — reviews + replies; reviewer
  identity excluded; fraud-voided rows dropped.

Money-promise holds structurally: there are no margin/commission/settlement
columns in the vendor schema to leak (0% commission + off-platform settlement).
The only pesos are the vendor's own list prices (returned to themselves) and the
couple's private budget (never vendor-exposed). Read-only this phase; availability
write + webhooks are a later phase. Reference page `/api/v1` updated.

SPEC IMPACT: New `api_access` entitlement on the Custom vendor plan + a new
Enterprise Vendor API surface (5 read endpoints, 5 `vendor.*` scopes). DECISION_LOG
row appended 2026-07-11. Surfaced for owner sign-off: `api_access` is a FREE toggle
(part of the negotiated Custom quote, not a separate priced add-on) and
Enterprise-without-an-active-Custom-plan grants NO API — both match the stated intent.
