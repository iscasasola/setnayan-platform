## 2026-07-09 · refactor(vendor): active-shop resolver seam + shared FULL/LEGACY fetch (multi-shop groundwork)

Forward-compat groundwork for the future **one user → many shops** model
(business verticals beyond weddings: insurance, car services, house services,
hotels, lodging, tourist guides). Aligns with the "Your shop = vendor twin of
Your events" home concept. **No behavior change for today's single-shop
product.**

- **Resolver seam** — `fetchOwnVendorProfile(supabase, userId, activeVendorProfileId?)`
  now takes an optional active-shop id. When one-user-many-shops lands, the shop
  picker / `/vendor-dashboard/[shopId]` route threads the chosen id through this
  ONE function instead of the ~185 call sites each re-deriving "the" shop from
  `user_id`. No caller passes the third arg yet → single-shop resolution (owner
  → first team membership) is unchanged, and the React `cache()` key still
  collapses to one entry. Fetch-by-id is RLS-safe: the `vendor_profiles` owner +
  `vendor_profiles_member_read` policies only admit shops the caller owns or is a
  team member of, so a forged/foreign id returns null.
- **Shared FULL/LEGACY read** — extracted `selectVendorProfileBy(column, value)`
  + `normalizeVendorProfileRow()`. Both the owner (`user_id`) and by-id
  (active-shop / team-member) paths now share the resilient FULL-then-LEGACY
  projection. Hardening: the team-member path was previously FULL-only and
  returned null on a transient projection error; it now gets the same graceful
  fallback the owner path always had.
- Behavior note: two narrow DB-error fallback cases now resolve *more* gracefully
  (member-path legacy fallback; and an owner-query error followed by a
  clean-empty legacy read now still checks team membership). All common paths are
  byte-identical.

Guardrail recorded for future vendor code: scope by `current_vendor_ids()` /
team membership, **never** `vendor_profiles.user_id`.

SPEC IMPACT: None (code-only groundwork). The multi-shop *product* decision —
shop picker UI, `[shopId]` routing, dropping `vendor_profiles.user_id UNIQUE`,
and migrating the ~28 single-owner RLS policies — is deferred until the owner
finalizes the business-connection model; the direction is logged at the bottom
of `DECISION_LOG.md` in the spec corpus.
