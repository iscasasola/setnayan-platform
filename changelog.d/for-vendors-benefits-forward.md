## 2026-07-01 · feat(for-vendors): benefits-forward tier ladder — Free spotlight + 4 tiers + Custom

Rebuilt the `/for-vendors` tier presentation to be benefits-forward and honest to the
2026-07-01 origin/main verification audit (`VENDOR_TIERS_AND_BENEFITS.md` §6).

- **New `VendorTierLadder`** replaces the dense `VendorPricingMatrix`: a **Free-Verified
  spotlight** (everything you get for ₱0, price shrunk to a tag) + **Solo / Pro / Enterprise
  / Custom** benefit-led "everything below, plus…" cards. Prices DB-driven (`getVendorPrices`),
  Enterprise bounded, Custom = "Talk to us".
- **Honesty scrub (per §6 / [[project_setnayan_public_claims_purge]]):** deep-dive "advantages"
  reworked from roadmap/admin-only claims (hand-curated intros, category-benchmarks-vs-peers,
  vendor-facing theft watch, Productions co-listing) → five genuinely-built ones (fit-matching,
  earned badges, Demand Radar + funnel + price-position, free import CRM, HQ-verified vendor
  partnerships). Stale "Crew-rate marketplace · Coming soon" → live **Manpower marketplace**.
  Removed the "unlimited team" Enterprise teaser (contradicts the bounded 10-seat cap).
- **Hero** no longer claims "AI matchmaking / AI proposal drafting" (overclaimed deterministic +
  zero-LLM features) → "team, wider reach, full reviews, and the data to grow."
- Token model framed honestly: answering a matched lead uses a region token on every tier
  (pay-per-lead, not free); 0% commission preserved.

`VendorPricingMatrix` is left orphaned (no importers) pending removal.

SPEC IMPACT: None — mirrors the already-committed `VENDOR_TIERS_AND_BENEFITS.md` (PR #2476).
Depends on the dashboard session's DB reprice (Enterprise ₱7,499) + `Infinity`→finite Enterprise
caps + Custom tier; page reads live DB prices so it tracks those automatically.
