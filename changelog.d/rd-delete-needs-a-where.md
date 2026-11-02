## 2026-10-03 · fix(db): three table rebuilds say WHERE, so the API stops refusing them

Production's Problems log held two open DB_WRITE_REFUSED rows —
`rpc/refresh_demand_radar_rollups` and `rpc/recompute_market_price_bands`, both
"DELETE requires a WHERE clause". Supabase's `safeupdate` refuses any DELETE or
UPDATE with no WHERE on API connections, even inside a SECURITY DEFINER function
or a CTE, and each rebuild opened with a bare `DELETE FROM <table>`. So the
background refill, the vendor-side radar refresh and the admin "Run now" all
failed before writing a row, and the tables read as "no data yet".

- Migration `20271261953500_a_wipe_says_where.sql` re-creates each function from
  its LATEST definition with one change: the wipe reads `DELETE FROM <table>
  WHERE true` (same rows, same gate, same return value).
- `recompute_market_funnel_bands` carried the identical bare wipe (admin "Run
  now" only, never pressed since, so not yet in the log) and is fixed the same
  way. A scan of every public function body after the full replay found no other
  unqualified DELETE or UPDATE.
- New guard `apps/web/tests/db/a-wipe-says-where.db.test.ts`: reads every public
  function body the replay ends with and fails on any DELETE/UPDATE without its
  own WHERE (the replay has no `safeupdate`, which is why every existing test
  stayed green), and runs each rebuild the way production calls it, proving it
  completes, clears stale rows and writes what it reports.

SPEC IMPACT: None.
