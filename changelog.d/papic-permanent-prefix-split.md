## 2026-06-25 · fix(papic): prefix-split sampler bytes on convert — make the R2 lifecycle rule data-loss-safe

Follow-up to the sampler storage-leak fix (#2138). That fix closed the orphan-bytes leak at the cap/presign layer and DOCUMENTED an R2 lifecycle rule on the `papic-sampler/` prefix as the guaranteed (cron-free) cleanup for *abandoned* sampler bytes — but flagged that enabling it naïvely would DELETE the photos of couples who CONVERTED (connected Drive / bought paid Papic), because `makeSamplerPermanent` cleared the DB expiry but left the bytes under `papic-sampler/`. This makes that lifecycle rule safe to enable.

The convert step now RELOCATES a kept couple's bytes off the ephemeral `papic-sampler/` prefix onto the permanent `papic/` prefix (the same prefix paid Papic uses), so the lifecycle rule's prefix only ever holds genuinely-ephemeral bytes.

- **`lib/papic-relocation-core.ts` + `.test.ts`** (new · pure, 8 tests) — `relocateRef()`: a single path-segment substitution `papic-sampler/` → `papic/`, idempotent (permanent / legacy / null refs are no-ops). Anchored on segment boundaries.
- **`lib/r2.ts`** — new `r2Copy()` (server-side `CopyObjectCommand`, same-bucket, no byte download).
- **`lib/papic-sampler.ts`** — `makeSamplerPermanent` now (1) relocates every still-ephemeral row's bytes for the event, then (2) clears the 30-day expiry (the original keep promise). Per-row FAIL-SAFE: a row flips permanent only once EVERY object copy succeeds — a partial R2 failure leaves it untouched (still under the ephemeral prefix, still inside its retention window) to be retried on the next convert. Best-effort delete of the old objects (the lifecycle rule is the backstop). Never throws (must not roll back a payment / Drive connect).
- **`app/api/upload/route.ts`** — a free-sampler shot on an ALREADY-converted event is now born under `papic/` (write-time prefix-by-permanence), so post-convert shots never strand under the ephemeral prefix. Fail-open to ephemeral on a kept-probe hiccup.

### ⚠️ Two corrections to the #2138 owner note — READ BEFORE adding the lifecycle rule
1. **The lifecycle rule needs TWO prefixes, not one.** Display/thumb derivatives live under a parallel `derivatives/` tree (`papic-derivatives.ts` → `derivatives/<originalKey>.<suffix>.jpg`), so sampler derivatives are at `derivatives/papic-sampler/…`. A rule on `papic-sampler/` alone would MISS them. Add expiry rules for BOTH prefixes (bucket `setnayan-media`, Expire/delete, age 37d): `papic-sampler/` **and** `derivatives/papic-sampler/`. The relocation handles both uniformly (segment substitution), so converted bytes leave both trees.
2. **The DB-aware retention sweep deletes only 2 of the 5 R2 keys** (`r2_object_key` + `poster_r2_key`; it misses `display`/`thumb`/`wall_safe`). The 2-prefix lifecycle rule above is the backstop that reaps those missed derivative bytes for non-converted expired rows, so this is covered — but a follow-up to extend `lib/papic-retention.ts` (+ `papic-retention-core.ts`) to delete all 5 keys would close it DB-aware too.

No user-visible change. There is currently no live sampler data in prod, so this is forward-looking. typecheck clean; lib unit tests green (8 new). Paid Papic pipeline untouched.

SPEC IMPACT: Papic sampler storage architecture — ephemeral vs permanent object prefixes; convert-time relocation. Logged in `DECISION_LOG.md` + memory `project_setnayan_papic_free_sampler`.
