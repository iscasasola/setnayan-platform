# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-09 · feat(vendors): crew size flows from the vendor's listing (quantity set by vendors)

Closes the gap deferred in #2924: the crew-meal coverage feature made the couple hand-enter each vendor's crew size, when a marketplace vendor already DECLARES it on its listing (`vendor_services.crew_size`). Owner intent was "quantity set by vendors" — so that value now flows through automatically.

- The vendor workspace reads each event-vendor's `marketplace_vendor_id` → the vendor's largest listed `crew_size` (across its `vendor_services`), building a per-profile map (public-read; degrades gracefully to couple-entry if unreadable).
- **Effective crew = `event_vendors.crew_size` (the couple's optional OVERRIDE) ?? the vendor-declared listing crew_size.** The crew-size input pre-fills with the effective value, and the crew-meal provider's "Covering N meals" total sums the effective crew of covered vendors — so it's accurate even before the couple re-saves each vendor.

No migration (the listing is read live; `event_vendors.crew_size` stays the override column added in #2924). Verified: `pnpm typecheck` clean.

SPEC IMPACT: refines the Crew-Meal Provider Marketplace coverage feature (DECISION_LOG.md 2026-07-09).
