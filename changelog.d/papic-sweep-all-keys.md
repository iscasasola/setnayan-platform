## 2026-06-25 · fix(papic): retention sweep now deletes all 5 R2 keys (close the variant leak DB-aware)

Follow-up to the prefix-split (#2145). The free-sampler retention sweep deleted only `r2_object_key` + `poster_r2_key` for an expired, non-converted sampler row — leaving its `display_r2_key`, `thumb_r2_key`, and `wall_safe_r2_key` derivatives stranded in R2 forever. A sampler photo carries up to FIVE distinct objects (original, clip poster, two display derivatives, the face-blurred live-wall variant), so the sweep was leaking 3 of 5.

This makes the cron-free DB-aware sweep delete **all five** — so the variant bytes are cleaned for visited events WITHOUT depending on the (owner-gated) R2 lifecycle rule. The 2-prefix lifecycle rule (#2145 note) remains the backstop for truly-abandoned events whose sweep never runs.

- **`lib/papic-retention-core.ts`** — `SamplerRow` gains the 3 derivative key columns; the delete loop sweeps all five, **deduped by ref** (a clip's `display_r2_key` IS its `poster_r2_key` per `generateClipThumb`, so they'd otherwise be deleted twice).
- **`lib/papic-retention.ts`** — the `fetchExpired` select now reads all five key columns.
- **`lib/papic-retention-core.test.ts`** — new case proving all five variants are deleted with the duplicate display/poster ref swept exactly once; existing fixtures extended.

Unchanged: the kept-event self-heal (converted rows are never swept), the bounded SWEEP_LIMIT, and the best-effort/never-throws contract. No migration; the columns already exist. No user-visible change.

SPEC IMPACT: Papic sampler retention — full variant cleanup. Logged in `DECISION_LOG.md` + memory `project_setnayan_papic_free_sampler`.
