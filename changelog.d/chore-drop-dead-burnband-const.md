## 2026-06-25 · chore(region): remove the dead deprecated BURN_BAND_REGIONS const

Post-review cleanup (adversarial audit). `lib/v2/region-token-burn.ts` exported a `@deprecated` `BURN_BAND_REGIONS` band→region map — a drift-prone second copy of a mapping that live code no longer uses (burn bands resolve entirely through `region-source.ts` ← `public.regions.burn_band`, via `regionBurnTokens()`). Verified the only references were its own definition + one doc-comment in `region-source.ts`. Removed the const + its JSDoc (kept `BurnBand`, `BURN_CEILING_TOKENS`, `DEFAULT_BURN_BAND`, `regionBurnTokens`); updated the region-source doc-comment lineage note.

SPEC IMPACT: None.
