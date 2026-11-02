## 2026-06-29 · docs(public): re-sync llms.txt pricing to the current canonical catalog

`apps/web/public/llms.txt` is a live, customer-facing AI-assistant pricing source
that had drifted from the catalog (last synced ~2026-06-13/06-28). Hand-maintained
file (no generator script). Re-synced every price to the current canonical numbers:

- **Vendor tiers repriced + annual-first ordering** (per owner): Solo ₱9,999/yr or
  ₱999/28d · Pro ₱24,999/yr or ₱2,499/28d · Enterprise ₱49,999/yr or ₱4,999/28d.
  0% commission, free verification, 100 free founder tokens, flat ₱100/token retained.
- **À-la-carte catalog realigned** to canonical prices: Setnayan AI ₱3,999 · Live
  Studio multicam ₱3,499/day (single-cam free) · Pakanta ₱2,499 · 3D Plan ₱2,499 ·
  Thank You Video ₱2,499 · Live Photo Wall ₱2,499/day · Animated Monogram ₱1,999 ·
  Couple Website PRO ₱1,999 · Stories ₱2,000/day cap · Cinematic Reveal ₱1,499 ·
  Camera Bridge ₱1,299/day · Pabati ₱1,299/day · Live Background ₱499 · Kwento ₱299 ·
  Papic Unli ₱100/cam·day · Papic Ltd ₱30/cam·day (cap ₱15,000/day) · Custom QR free.
- **Retired SKUs removed** from the live listing: Patiktok, Indoor Blueprint, High
  Res Archive, Call-Time Escalator, Papic 5-Seats, Papic Guest, Pro/Event/Editorial
  Website, RSVP / RSVP Pro standalone, SDE / Same-Day Edit, customer token wallet,
  "Setnayan Concierge".
- **Bundle tiers removed entirely:** Setnayan Essentials (₱12,999) and Setnayan
  Complete (₱27,999) were deactivated in the DB and no longer exist — every
  reference removed. The model is now Free ₱0 → Setnayan AI ₱3,999 → à-la-carte
  services, with no package bundles.
- Renamed Panood → Live Studio in pricing/FAQ surfaces; refreshed the footer
  changelog note to 2026-06-29.

Non-pricing prose (brand mentions, capability lists, privacy/launch copy) left
unchanged per scope.

SPEC IMPACT: None — llms.txt is a generated-from-catalog public mirror, not a spec
source. Canonical pricing already lives in `Pricing.md § 00` + memory
`project_setnayan_pricing_tiers`; this only re-syncs the public AI-assistant file.
