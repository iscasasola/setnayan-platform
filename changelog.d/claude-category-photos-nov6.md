## 2026-11-06 · feat(taxonomy): photos for the 6 groups and 16 categories that had none

Owner picked them 6 Nov ("Yes, use them"): Higgsfield Soul 2.0, house look, each checked at full size.
22 files under `apps/web/public/onboarding/refinements/<id>/_main.webp` (900×675 webp, the same shape as every existing category photo).
One data-only migration sets `service_categories.sample_photo_r2_key`, but only where it is still empty, so a photo set in Admin › Categories is never overwritten.
`event_insurance` reuses the Insurance group photo; the approved taxonomy merge folds the three insurance categories into one.

SPEC IMPACT: None. These are content, not decisions; the photos stay editable in Admin › Categories.
