## 2026-07-01 · feat(vendor-tiers): beef up Solo + revive the editorial cap

Solo was thin (only unlimited answering + funnel trends + 3 services separated
it from free-verified). Owner chose to give it real weight, plus finish the
genuine owed gate.

- `lib/vendor-tier-caps.ts` — new cap `soloBusinessTools` (Solo+, monotonic
  across all 5 tiers) + `canUseSoloBusinessTools()` helper.
- Gated `/vendor-dashboard/earnings` and `/vendor-dashboard/recaps` → Solo, same
  flag-dark pattern + shared `VendorTierGate` upsell. Deliberately did NOT gate
  the bookings pipeline (core get-booked flow) or anything in discovery/trust.
- Editorial cap revived: `editorialTagged` was "dead" only because the display
  hardcoded `tier === 'pro' || 'enterprise'`. Refactored `lib/showcase-db.ts` +
  `app/[slug]/_components/editorial/data.ts` to read `tierCaps(tier).editorialTagged`.
  Zero behaviour change (`editorialTagged` ≡ pro/ent) — makes the cap non-dead
  and fixes a latent `solo`-omission in the editorial tier union (solo now
  correctly renders as a plain credit, not tagged). NOT flag-guarded — it's a
  behaviour-preserving refactor.
- Bid Button (the other "owed"): confirmed roadmap-only — zero code references;
  the custom slug is already Pro-gated via `customWebsiteName`. Nothing to split
  in code; stays "soon" in marketing.

Solo now earns ₱999 on: unlimited weekly inbound (∞ vs 10/wk) + funnel trends +
earnings analytics + recap sharing + 3 services/category. The earnings/recaps
gates stay flag-dark (`VENDOR_TIER_FEATURE_GATE`), activating with the other
hybrid gates; free vendors (founder/demos) are unaffected until the owner flips
the flag once paid vendors exist.

SPEC IMPACT: In-repo SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §5 updated.
Corpus decision-log row added via authorized direct-edit. No DB schema/SKU/price
change.
