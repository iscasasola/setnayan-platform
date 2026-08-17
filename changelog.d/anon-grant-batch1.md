## 2026-08-17 · fix(security): the second lock — batch 1 of the anon grant sweep

**Measured in prod 2026-08-17:** 383 public tables · RLS enabled on **all 383** ·
306 grant `anon` something · **213** of those have no policy that could ever
admit an anonymous reader.

🟢 **Nothing was leaking.** RLS denies every one of them. This changes no answer
any client receives today.

🔴 **But the grant is far wider than "read."** On those 213 tables `anon` holds
**SELECT 212 · DELETE 212 · UPDATE 207 · INSERT 206 · TRUNCATE 213** — the
Supabase default privilege set, applied to `public` and never narrowed. RLS is
the only thing between an anonymous holder of the publishable key and all of it.
(TRUNCATE is not covered by RLS at all; it is not reachable, because PostgREST
never exposes TRUNCATE, so it is an over-grant rather than a live hole.)

**Batch 1 closes 16 tables** — every one passing all **six** gates: anon holds
privileges · no policy can admit anon · **no column-level grants** (six tables in
this schema carry 532 of them; a table-level REVOKE silently drops them, and none
of the six are in this batch) · no `from('<table>')` in app code · the name
appears nowhere in app source · **not reachable by anon through a
`security_invoker` view chain**. 175 of the 212 fail gate 4 and are untouched.

🚨 **GATE 6 WAS LEARNED THE HARD WAY AND CI CAUGHT IT.** A `security_invoker`
view runs with the CALLER'S privileges on its base tables, so anon reading such
a view needs the grant on everything underneath — even though no application
code ever names that table, which is exactly why a source scan says it is safe:

```
vendor_market_stats → vendor_active_ads → vendor_ad_subscriptions
vendor_active_tools                     → vendor_tool_bundles
```

Revoking the first would have **emptied the marketplace listing for every
signed-out visitor**. **CI named only that one.** Nothing asserts
`vendor_active_tools`, so fixing the reported failure alone would have shipped
the second break. Both pulled from the batch, and a new assertion holds the
grants OPEN so the next batch cannot re-add them by re-running the same scan.
🔑 *Enumerate the dependency graph; do not fix the one instance the failure
happened to name.*

**Also closes the residual the 2026-08-11 view pass wrote down verbatim.** Any
signed-in user could read any supplier's unredacted completed-jobs count; the
difference from the public count is that supplier's written-off jobs. The grant
was kept for "the vendor's own backend card" — whose reader has **zero callers**,
re-verified on origin/main. No design change needed after all. The existing test
asserting the opposite is **reversed, with its reasoning kept**, and
`lib/vendor-profile.ts` now carries the instruction to scope any future reader to
the caller.

**Found on the way: two prod-only tables.** `event_service_deliveries` and
`pioneer_incentive_logs` exist in production and in **no migration** — no
`CREATE TABLE` anywhere. Surfaced by the PGlite replay refusing a REVOKE against
a relation it had never been told to create. They are revoked behind a
`to_regclass` guard so prod is closed while the replay stays green. **The drift
itself is reported, not fixed** — writing a CREATE TABLE for a table that already
exists means guessing its shape, and guessing wrong is worse than the drift.

New guard `tests/db/anon-table-grants-closed.db.test.ts`: a REVOKE is a
point-in-time act, and the anon-RPC work already learned that a later
`CREATE OR REPLACE` silently re-applies default privileges with CI green.

The exposure baseline is **deliberately not regenerated** — the freeze passes
narrowings by design, and another session is concurrently editing that same
generated file, which has turned main red before.

Dry-run against production inside a rolled-back transaction: SELECT/DELETE/
TRUNCATE `true → false`, control table unchanged, `authenticated` untouched,
column-ACL rows 376 → 376 (no collateral). Verified nothing persisted.
Mutation-tested three ways with occurrence counts.

SPEC IMPACT: None.
