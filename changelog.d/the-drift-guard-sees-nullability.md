## 2026-09-06 · fix(schema-drift): the guard now compares NULLABILITY, not just column names

`schema-drift.db.test.ts` replays the migrations and diffs the result against a
committed snapshot of production. It is a careful guard — three-input diffing so
pending migrations stay quiet, anti-vacuity floors, a reasoned allow-list, a
neutralisation proof. Its query was:

```sql
SELECT c.relname AS t, a.attname AS c
```

**Column names only. Never `attnotnull`.** So it compared which columns exist and
was structurally blind to whether production enforces anything about them.

🔑 **THAT BLIND SPOT SHIPPED TWO DEFECTS IN ONE DAY, BOTH ON ONE TABLE.**
`comp_grants.granted_by` was `NOT NULL` in prod and nullable in the migrations, so
an `ON DELETE SET NULL` foreign key would have made **admin accounts undeletable**
(23502 instead of a nulled stamp) — caught only because someone queried prod's
catalog by hand. Hours later `comp_grants.user_id`, same shape: a vendor SKU comp
writes `user_id: null` deliberately, so the feature **could not have run once in
production** while all 2,350 db tests stayed green. Neither was visible to any
test on this machine.

The snapshot now carries a third section, `[notnull]`, and the guard diffs it with
the same three-input logic as the columns — so a pending migration that adds or
drops a NOT NULL stays silent until it is actually applied. Two new divergence
kinds:

- **NOT_NULL_ONLY_IN_PROD** — the direction that ships broken features. The
  report says so, names the column, and mentions 23502, because a failure nobody
  can act on gets rubber-stamped.
- **NOT_NULL_ONLY_DECLARED** — the suite is stricter than reality; usually a
  stale snapshot, occasionally a declaration that is lying.

**On its first real run the guard independently found `comp_grants.user_id`** —
the defect discovered by hand that morning — plus `comp_grants.rationale`, and
nothing else. Both are recorded in `KNOWN_GAPS` with reasons (ceiling 2 → 4), not
silently repaired: `user_id`'s direction is settled and waiting on PR #5246 to
deploy, while `rationale`'s is genuinely undecided — every writer supplies one,
but a shipped db test inserts without it, so declaring `SET NOT NULL` would break
that test and might be enshrining an accident. The ratchet's dead-entry check
deletes both the moment they stop being true.

**The refresh also closed a gap nobody had noticed.** The committed snapshot's
ledger head was `20271032282809`; production is at `20271209362403` — the guard
had been comparing a **326-migration-old** prod against an equally old
declaration. Internally consistent, and blind to everything shipped since,
including all of that day's work. `20271029279897_known_hash_match_checks` was
also applied in prod and absent from the ledger. Refreshed: 1,025 → 1,351 ledger,
4,618 → 5,052 columns, and 3,136 NOT NULL. With that fresh snapshot there are
**zero** column divergences — the declaration and prod agree on existence
everywhere; only nullability disagreed.

Held by a neutralisation proof that fires on both directions and stays quiet on a
pending change, an orphan check that `[notnull]` and `[columns]` came from one
generator run (it caught its own author pairing a fresh read with a stale list),
and a `MIN_NOTNULL` floor so a truncated section cannot turn the new half into a
comparison against nothing.

SPEC IMPACT: None — a test guard and a generated snapshot; no schema, price or
behaviour changes.
