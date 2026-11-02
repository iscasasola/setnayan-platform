## 2026-07-11 · feat(api): /api/v1 SDK is an enterprise-vendor feature (bless the breach, scoped)

Owner: "api is for enterprise vendor accounts." Resolves the 2026-07-04 kill-or-bless: BLESS the bearer SDK, scoped to enterprise vendors.

- New `lib/enterprise-vendor-gate.ts` → `userOwnsActiveEnterpriseVendor(admin, userId)`: owns a `vendor_profiles` row at tier ≥ enterprise (Custom counts) with a non-lapsed `tier_expires_at`.
- **Enforced at the auth choke point** (`lib/api-auth.ts`): every bearer request now 403s (`not_enterprise`) unless the key owner is an active enterprise vendor — this is also the **downgrade defense** (a key stops working the moment the tier lapses).
- **Key-minting gated** (`api-keys/actions.ts`): only enterprise vendors can create keys; the dashboard page shows an Enterprise upsell instead of the form for everyone else.
- **The 4 bearer routes** (`me`, `events`, `events/[eventId]`, `events/[eventId]/guests`) are un-killed (guard removed) — now enabled + enterprise-gated by the auth check.
- Still killed by `PUBLIC_API_ENABLED` (unchanged): the no-auth PUBLIC vendor directory (`vendors`, `vendors/[publicId]`), dead `reviews`, V2 `manpower/*`.

**Endpoint-design gap (flagged, NOT fixed):** the bearer endpoints today return the key owner's own COUPLE-scoped data (`me`/`events`/`guests`) — there is no vendor-scoped resource (bookings/leads/inquiries keyed to the owned `vendor_profile_id`). So the API is now enterprise-*only* but not yet enterprise-*useful*; a `/api/v1/vendor/*` resource is the next feature.

Verified: typecheck clean.

SPEC IMPACT: Logged in DECISION_LOG 2026-07-11 — resolves the API kill-or-bless (bless/enterprise-scoped).
