## 2026-06-25 · refactor(studio): in-app services consistency — Tier 2 (flag-driven routing)

Second tier of the In-App Services Consistency Plan. Turns the open/learn-more
decision from hardcoded per-feature if/else into declared catalog data —
behavior-identical, just no longer special-cased in code.

- New `opensDirect?: boolean` on `AddOnEntry`. Set true on the 7 services that
  open their own surface directly (skip the /studio/about interstitial): panood,
  seating, rsvp, event, editorial, landing-page, supplies-marketplace.
- `appStoreDetailHref()` no longer hardcodes those keys — it reads the flag
  (`entry.opensDirect → addOnHref` else the shared /studio/about/<key> page).
  landing-page keeps one explicit case (its card opens the editor overview, which
  differs from addOnHref's /website hub) — documented, pending the website-parts
  consolidation.
- The guard test's `OPENS_OWN_SURFACE` is now DERIVED from `opensDirect` instead
  of a parallel hardcoded list, so the routing and the "every non-direct service
  must have a learn-more page (no 404)" guard can never drift.

Adversarially verified behavior-identical for every catalog key. Tier 3 (collapse
the 3 ownership readers to eventSkuActive + the universal "own it → open the
tool" deep-link) follows.

SPEC IMPACT: none (catalog refactor); In_App_Services_Consistency_Plan_2026-06-25.md.
