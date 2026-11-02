## 2026-09-03 · fix(security): the price is public, what it costs us is not

`public.platform_retail_catalog_v2.saas_overhead_cost_php` — our internal per-SKU
model/vendor cost — was readable by **anonymous visitors in production**. The
publishable key is inlined into the prod bundle by design and PostgREST is
reachable directly, so this was not "a column an admin page can see"; it was one
`curl` away, for every SKU we sell, with no account and without loading a page.
Subtracting it from `retail_price_php` gives our margin on the whole catalogue.

Measured against prod 2026-09-03 by executing it, not inferred:

```sql
select has_column_privilege('anon','public.platform_retail_catalog_v2',
                            'saas_overhead_cost_php','SELECT');   -- true
select count(*) from platform_retail_catalog_v2
 where saas_overhead_cost_php is not null;                        -- 35 of 35 (avg ≈ ₱311)
```

⚠ **PRE-EXISTING, and not caused by any recent PR.** The column and the
`platform_retail_catalog_v2_public_read … USING (true)` policy both landed in
`20260628000000`. It surfaced while reviewing **PR #5146** (MB2), which adds a
36th row to the same table — that PR is not the cause and was not blocked on it.

🔑 **Nobody granted this.** `relacl` read `anon=arwdDxtm` because the database
carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,
authenticated` — every table in `public` ships OPEN. And RLS could never have
saved it: **RLS is ROW-level and cannot hide a column**, which is precisely why
`supabase/security/README.md` keeps a `col` line per column.

### The fix — `20271201188010_the_catalog_keeps_its_margin.sql`

Postgres cannot subtract a column from a table-level grant, so the table
privilege is revoked and an explicit column list granted back — the identical
mechanism as `20271007100000` on `events`. The allow-list is **COMPUTED at apply
time** (`information_schema` minus a deny-set), never hand-enumerated; this table
gains columns often and a hand-typed list is how a legitimate read breaks.

Denied to `anon` + `authenticated`: `saas_overhead_cost_php` (the margin leak)
plus three internal bookkeeping columns the same audit turned up —
`retirement_reason`, `retired_by_admin_id`, `updated_by_admin_id` (the last two
are `auth.users` UUIDs of Setnayan staff). The three bonus columns are denied
**if present** rather than asserted to exist: a hard `RAISE` on an absent bonus
column would fail `db push`, and on this project `deploy-prod` runs
`db push --include-all` **before** the Vercel hook, fail-closed — one refusing
migration strands every subsequent merge (2026-09-02: seven PRs, three hours).

`REVOKE ALL`, not `REVOKE SELECT`: the stock grant is `arwdDxtm`, so `anon`
nominally held INSERT/UPDATE/DELETE on the **price list**, with only the absence
of a write policy stopping it. That is one mechanism deep, and SEC-4b
(`20271008178212`) is this project's costed lesson in not leaving it there. All
12 catalogue writes in `apps/web` go through `createAdminClient()`.

### Why nothing breaks

Every `.from('platform_retail_catalog_v2')` call site was extracted and the
client each query is **chained off** was resolved — not merely which clients the
file imports, which is a different and misleading question (several import both).
Re-measure with:

```bash
grep -rn -B1 "\.from('platform_retail_catalog_v2')" apps/web/app apps/web/lib | grep -vE '\.test\.' | grep -oE '(await )?[a-zA-Z_]+$' | sort | uniq -c
```

The overwhelming majority chain off `admin` (`createAdminClient()`) — service-role,
which bypasses grants entirely. That includes the **only** reader of the cost
column (`lib/v2-catalog.ts` `fetchV2CustomerCatalog`) and **both** `select('*')`
calls (`app/admin/pricing/actions.ts`).

**Seven** queries chain off a session client. Every one names its columns
explicitly and **none names a denied column** — the couple's Studio and Suite
pages, the supplier recommendations picker, `lib/papic-cameras.ts`,
`lib/payable-by-reference.ts`, and the two `setnayan-ai` pricing libs. A
post-condition and a test assert all of those columns survive, `onboarding_price_php`
included, so an over-eager future edit to the deny-set fails there rather than
blanking a signed-in couple's Suite grid.

SQL callers were checked separately, because **a TS grep cannot see one**: exactly
one function in `public` reads this table in its body — `event_comp_active_skus`
— and it is `SECURITY DEFINER`, so no session-role grant reaches it. There are no
views over the table and no `'use client'` file reads it.

🔑 **No reader at all resolves to `anon`** — every session-path reader is behind a
sign-in or takes an injected server client. `anon` is kept on the allow-list
anyway: the catalogue is a **deliberately world-readable price list**
(`20271139128584` says so in as many words) and retiring that is an owner call,
not a side effect of a margin fix. **Open question for the owner:** revoking
`anon` outright is a one-line follow-up and strictly safer — worth doing?

### The guard, and its sabotage proof

`apps/web/tests/db/the-catalog-keeps-its-margin.db.test.ts` — 20 cases on the full
replayed schema, built to the SEC-4b four-defence shape because this repo has
twice shipped DB tests that passed because the connection **owned** the table:

1. **META** — `current_user` really is `anon`/`authenticated`, does **not** own the
   table, holds neither `BYPASSRLS` nor `SUPERUSER`.
2. **The refusal is real** — not just `has_column_privilege` false, but an actual
   42501 on `SELECT cost`, on `SELECT *`, and on the two blind-search oracles a
   row policy leaves open (`WHERE cost > 100`, `ORDER BY cost`) — Postgres
   requires SELECT on any column named in a predicate, so `?order=` fails too.
   **A policy re-scope would not have closed those.**
3. **Positive + differential controls** — the same anon session still reads
   `service_code/title/retail_price_php`, and every denied statement succeeds as
   `service_role`. That attributes the denial to the COLUMN, not the role or RLS.
4. **Two neutralisation proofs** — re-`GRANT` the column inside a transaction,
   assert the leak **returns**, roll back; and the same for a table-level
   `GRANT ALL`, which is the shape a future migration would actually undo it with.
   If the `REVOKE` were ever deleted, these go red instead of the suite quietly
   becoming a no-op.

Plus the anti-rot case the `events` lock-down needed a whole lint script for:
**every column must be DECIDED** — granted, or listed in `DENIED_COLUMNS`. A new
column that is neither fails with the exact two-line instruction. This matters
because the allow-list is a snapshot: PostgREST refuses the **whole query** naming
an ungranted column, and on `events` that trap took three shipped screens dark for
weeks (`20271179873885`).

### The wider audit (requested; reported, not silently fixed)

All **40** tables carrying a blanket `USING (true)` public-read policy were
cross-referenced against their columns. **`saas_overhead_cost_php` is the only
internal cost/margin column among them** — the two sibling price tables
(`service_catalog`, `vendor_billing_catalog`) carry a price and no cost.

Two lower-severity findings are **left for the owner, deliberately not fixed here**:

- **`updated_by_admin_id` / `retired_by_admin_id` / `override_admin_id` are
  world-readable on 8 other blanket-public tables** — `feature_policy`,
  `homepage_background_videos`, `platform_package_catalog`, `reveal_studio_config`,
  `site_widgets`, `vendor_billing_catalog`, `vendor_reviews`,
  `vendor_service_recommendations`. These are `auth.users` UUIDs of staff accounts.
- **`vendor_reviews.override_reason` + `override_admin_id`** — an admin's internal
  rationale for overriding a public review, readable by anyone.

Fixing eight more tables in this PR would have made the margin fix unreviewable.
Each is the same one-line shape as this one.

Verified: new suite **20/20** · full `test:db` **/** typecheck **/** exposure
baseline regenerated (all narrowings — see the diff).

SPEC IMPACT: None — no product surface, no pricing change, no schema shape change.
No column is added, dropped or retyped; only grants move, and every customer-facing
price column stays exactly as readable as it was.
