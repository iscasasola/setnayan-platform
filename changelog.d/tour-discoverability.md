## 2026-06-20 · feat(tour): entry CTAs + fix vendor-match category slugs & catering prices

Makes the public Maria & Jose tour (shipped in #1910/#1915) reachable and fixes two data/matching defects found by verifying the live stops.

**Discoverability — `/tour` entry CTAs** (the tour had zero inbound links):
- Homepage hero — replaced the vague "See how it works ↓" anchor with "See a real wedding →" → `/tour` (concrete, show-don't-tell secondary CTA).
- Explore search hero — "Not sure where to start? Walk through a real wedding →" below the popular chips.
- For-vendors hero — "Curious what couples see? Walk through a real wedding →" under the register CTAs.

**Vendor-match fix** — the tour's `TOUR_CATEGORIES.canonicalServices` used coarse slugs (`photographer`, `videographer`, `florist`, `band_dj`, `makeup_artist`, `venue`…), but the matcher does `overlaps('services', …)` against `vendor_profiles.services`, which holds **leaf** taxonomy slugs for both real and demo vendors (confirmed: the real founder vendor uses `['photography']`). Only `catering`/`host_emcee` happened to match, so 4 of 6 buckets came back empty. Rewrote to leaf slugs (`photography`/`videography`, `dj`/`live_band`/`host_emcee`, `garden_wedding_florist`, `bridal_hair_stylist`/`bridal_hmua`, `wedding_cake`). Dropped the "Reception venue" bucket (Setnayan has no venue marketplace category — no venue tile in the taxonomy) and replaced it with "Cake & sweets". All 6 buckets now return 3–8 vendors.

**Sample-data fixes** (applied to prod via `db query`; scripts committed re-runnable):
- `scripts/fix-sample-catering-prices.sql` — the seed fat-fingered an extra digit on the 3 catering services (₱1.2M–₱1.6M ≈ ₱8,000/pax), which made the budget stop show Catering at **85.7%**. Corrected to realistic totals (₱270k–₱385k), both `starting_price_php` + `starts_at_centavos` in lock-step (the field `buildVendorPricingLookup` reads). Source seed corrected too.
- `scripts/seed-sample-event-maria-jose.sql` Block 4 — adds 3 `makeup_artist` demo vendors (`services=['bridal_hmua']`) so "Hair & makeup" isn't hair-only (was missing entirely). Idempotent, `is_demo`+`demo_batch_id`, shortlisted to the event.

Verified live: all 5 stops render the seeded data; gallery wall shows "8 moments and counting"; budget pie now realistic; all 6 vendor buckets populate.

SPEC IMPACT: None (public read-only tour wiring + demo/sample data correctness; no SKU / schema / pricing / branding change).
