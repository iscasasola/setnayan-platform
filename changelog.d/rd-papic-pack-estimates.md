## 2026-10-15 · feat(onboarding): Papic packs state their own estimate — the guest-count recommendation is removed

Owner 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS", answer 1).

- The onboarding Papic card no longer says "We recommend N credits for your X guests". `lib/onboarding/papic-recommendation.ts` (and its test) is deleted; the onboarding view model no longer reads `papic_event_pool_config` sizing.
- Every pack — the approved wedding's − [pack] + picker, the running-total stepper and the read-only ladder — says "about N photos, or N short clips" (`papicPackEstimatePhrase` in `lib/papic-tier-copy.ts`, from `PAPIC_POINTS_PER_PHOTO` / `PAPIC_POINTS_PER_SNIPPET`, through `formatCount`).
- The pack picker opens on the pack already added, else the smallest paid pack (builder's call: with no recommendation there is no other default).
- `points_per_guest` / `papic_event_pool_config` untouched — still the spending ceiling for paying events.
- Guard `lib/the-recommendation-waits-for-data.test.ts` re-aimed: no module may now size a pack from the guest count (sabotaged twice).

SPEC IMPACT: None — the ruling is already recorded in DECISION_LOG (2026-10-15, "SIX OWNER ANSWERS").
