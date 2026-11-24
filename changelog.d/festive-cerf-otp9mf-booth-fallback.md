## 2026-11-23 · fix(onboarding): sign-up's fallback no longer offers the retired Video booth

The follow-up to #8233 (the data migration that retires `photo_booth` / `Patiktok` in `onboarding_refinement_options`).

- Sign-up reads its "what kind of X?" options from the database, where only active options are shown (`getOnboardingRefinements`, `lib/onboarding-refinements.ts`). When that read fails it shows the built-in `REFINEMENTS_DATA` list instead (`app/onboarding/wedding/_data/refinements.ts`).
- That built-in list still offered "Video booth" (key `Patiktok`), so a failed read brought the retired booth back. It is now removed from the `photo_booth` leaf; the other five booth options are unchanged.
- The image `public/onboarding/refinements/photo_booth/patiktok.webp` stays, because the retired database row still points at it.
- Guard: `app/onboarding/wedding/_data/the-fallback-offers-no-retired-booth.test.ts`. No fallback option may match a retired product (`RETIRED_ADD_ON_KEYS` / `RETIRED_PRODUCT_NAMES` in `lib/retired-products.ts`) by key or label, and the photo booth has no Video booth. Putting the option back turns both tests red.

SPEC IMPACT: None. It carries out DECISION_LOG 2026-11-23 "Seven open calls settled" item 7 (and the 2026-11-20 Patiktok retirement) for the fallback list too.
