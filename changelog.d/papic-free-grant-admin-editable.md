## 2026-07-28 · fix(papic): the free-pool grant now reads the admin-editable allowance instead of a hardcoded 50

Follow-up to #3847/#3848, which armed the free Papic pool. Self-reported defect in that work.

**What was wrong.** `ensureFreePapicPoolGrantAdmin()` baked the allowance in as a new `PAPIC_FREE_POOL_POINTS = 50` constant. But `papic_event_pool_config.free_grant_points` already existed as the **admin-editable** source, and `lib/papic-tier-copy.ts` — *"the ONE place every Papic capacity / price / cap CLAIM is derived"* — already carried `PAPIC_FREE_GRANT_POINTS_FALLBACK = 50` and documented that column as the live value.

So the number lived in **three** places, and the grant ignored the admin control entirely. An admin raising the allowance to 90 would have moved the **copy** to "about 90 photos" while the **meter kept handing out 50** — display and enforcement disagreeing, which is the exact bug class `papic-tier-copy.ts` was built to prevent.

**The column was decorative.** `papicFreeGrantPoints(config)` reads `config.freeGrantPoints`, but `fetchPapicTierConfig()` queries a *different* table (`papic_tier_config`) and never sets that key — so the helper could only ever return its fallback, and `papic_event_pool_config.free_grant_points` was read by nothing in the codebase. That was invisible while the pool was unarmed and no surface displayed it. Arming the pool is what made it matter.

**The fix.**

- **`fetchPapicFreeGrantPoints(supabase)`** — new, in `papic-tier-copy.ts` beside the other readers: the single live reader of the admin column, falling back to `PAPIC_FREE_GRANT_POINTS_FALLBACK` in one place.
- **`freePapicGrantRow(eventId, points)`** now takes the resolved allowance instead of baking one in, and `ensureFreePapicPoolGrantAdmin()` resolves it per call. Not cached: event creation is rare, the read is one indexed row, and a stale cache would mint the *old* allowance after an admin edit — the very drift being removed.
- **`PAPIC_FREE_POOL_POINTS` is deleted.** Three copies collapse to one fallback literal, shared by the grant and the copy helpers.

**Guarded against the bad-config case.** `papic_event_point_grants` CHECKs `points > 0`, so a `0`, negative, `NULL`, or unparseable config value would make every arm fail its insert silently and drop the event straight back to **unmetered** — undoing the whole point of #3847. The reader rejects all of those to the fallback, and truncates fractions to whole points. Six bad values are covered by test.

Also hardened the migration drift guard to resolve its file **by slug rather than by prefix**, since that migration was already renumbered once (`20271017100000` → `20271017567807`) after a duplicate-prefix collision; pinning to a number would have silently stopped guarding.

Verified: typecheck 0 · `next lint` 0 errors · unit **5141/5141** (11 in this file, 6 new). No migration — the backfill already ran at 50, which equals the live config value, so no data repair is needed.

SPEC IMPACT: None. The allowance is unchanged at 50 (`Papic_One_Pool_Model_Spec_2026-07-22.md` §0); this makes the admin control that sets it actually work.
