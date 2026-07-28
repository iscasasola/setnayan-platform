## 2026-07-28 · fix(migrations): reissue papic_free_pool_grant_arm under a fresh prefix — its twin claimed the version and it never ran

`20271017100000_papic_free_pool_grant_arm.sql` and `20271017100000_vendor_verified_requires_stamp.sql`
landed on main with the SAME hand-typed prefix. The runner keys applied migrations by prefix;
`vendor_verified_requires_stamp` was recorded at `20271017100000`, so the papic file was silently
skipped — verified in prod: the unique index `papic_event_point_grants_one_free_per_event` is absent
and the free-pool backfill wrote 0 rows. The papic file is deleted and its byte-identical (idempotent)
content reissued as allocator-sourced `20271017567807_papic_free_pool_grant_arm_reissue.sql`, which
will actually apply on the next dispatch. This also unblocks `pnpm migration:check` (and therefore CI)
for every open PR.

SPEC IMPACT: None

Also fixes the pre-push guard itself: RULE 1 unioned the pushed tree with origin/main's file
list, so a push that DELETES one of main's duplicate twins was blocked by the very duplicate it
removes. Now, when every pushed commit already contains origin/main, the pushed tree alone is
scanned (deletions are intentional); the union survives only for stale branches, where it is
the cross-branch collision catch.
