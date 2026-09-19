## 2026-09-19 · fix(couple): loadDayOfBroadcast logged its refused read twice — main was red

PR #5669's own S41b fix and an independent main-side fix both added a `[supabase-error]` log for
`app/[slug]/_lib/loaders.ts`'s `coordinator_broadcasts.select` read in `loadDayOfBroadcast`. After
merging `origin/main`, `apps/web/lib/s41c-unclassified-batch-f-reads-are-honest.test.ts`'s
"the remaining 9 shape-1 sites…" test failed 1/9: the needle now matched 2, not 1.

Confirmed this is a genuine duplicate at ONE query site (not two distinct reads) — both log calls
carry the identical marker for the identical `.from('coordinator_broadcasts')` call, one line apart.
Removed the single-line log this PR added and kept the richer multi-line block (with its explanatory
comment) that was already on `origin/main`. No assertion in the test was loosened.

SPEC IMPACT: None
