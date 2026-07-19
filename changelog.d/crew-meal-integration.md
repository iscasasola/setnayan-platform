# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-08 · feat(vendors): Crew Meals coherence across the service editor, cards, and admin config

Integrates the `crew_meals` category across the surfaces that need category-aware treatment (the plumbing shipped in #2868 / #2870).

- **Correctness (bug fix):** a crew-meal listing IS the crew meal, so the self-contradictory "crew meal required / Crew meal not included" flag is suppressed — hidden in the vendor editor (`IncludedFlags` forces "included" via a hidden input when `category==='crew_meals'`) and dropped from the public card (`app/v/[slug]/page.tsx`), the couple-dashboard card (`vendor-marketplace-info.tsx`), and the live preview (`service-card-live-preview.tsx`).
- **Wording:** per-guest pricing now reads "**/meal · min N meals**" (not "/guest") on crew-meal listings. Threaded a `category` prop through `PricingBasisEditor` + `IncludedFlags` (wizard + inline-editor call sites in `service-wizard.tsx` / `services-manager.tsx`); the live preview reads `category` straight from the form; the public + compact cards branch on category.
- **Admin / config (migration `20270522065533`):** seeds the `crew_meals` row in `budget_leaf_benchmarks` (so it's an allocatable budget leaf in the couple's Budget Planner + `/admin/budget-planner`; price columns stay NULL per the "never invent a benchmark" rule) and `planning_deadlines` (1-month default — matches `monthsBefore`, clears the admin missing-deadline flag). `LEAF_CANONICAL_SERVICES` gains `crew_meals: ['crew_meals']` so real crew-meal vendor prices feed the leaf median.

Confirmed **NO change needed (correctly)**: `/pricing`, `/admin/pricing`, the homepage, and `/vendors` — Crew Meals is vendor-self-priced with **no Setnayan SKU**, so it's correctly absent from every price/SKU surface (adding one would break the 0%-commission model). The discovery chips, `/explore`, and the admin taxonomy viewer are data-driven and already auto-include it.

**Deferred (documented):** the `get_vendor_event_brief` `cat_to_leaf` map (a crew-meal vendor seeing the couple's crew-meal budget band, gated on opt-in) — niche value, and re-emitting the ~200-line `SECURITY DEFINER` function unsupervised isn't worth the blast radius. Follow-up.

Verification: `pnpm typecheck` clean; `pnpm test:unit` 1089/1089 pass.

SPEC IMPACT: None new — surface integration of the already-recorded Crew-Meal Provider Marketplace (DECISION_LOG.md 2026-07-08).
