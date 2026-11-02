## 2026-09-11 · security(grants): two privileges no browser path uses, taken back (N5 · part D)

- **TRUNCATE on `chat_threads`** (found by N4, #5435): `anon` and `authenticated` held
  table-level TRUNCATE (the stock grant; production read-only 2026-09-11). RLS is never
  consulted for TRUNCATE; not reachable through PostgREST, but zero cost to remove.
  Revoked. (The same stock grant sits on 347 public tables for `authenticated` and 197
  for `anon` — only this table was in scope; a sweep is a separate change.)
- **SELECT on `vendor_profiles.next_renewal_due_at` for `authenticated`** (found by L3,
  #5433): the Verified badge's deadline tells a 182-day vouch from a one-year approval for
  every verified shop. `authenticated` holds only column-level SELECT on this table (since
  20271217955839), so a column revoke is effective (asserted). Every reader was checked:
  the marketplace badge, the admin verification desk + approve action, the badge-deadline
  sweep and the RA 10173 export all read on the service role; the shop reads its own
  through `vendor_profiles_self` (definer view, unchanged). `anon` never held it.
- Migration `20271222518385` (6 post-conditions). Exposure baseline regenerated: **1 line,
  a narrowing** (`vendor_profiles.next_renewal_due_at authenticated=SIU → IU`); header
  6636 = body 6636, every per-kind count equal. TRUNCATE is not a tracked fact.
- `tests/db/a-shop-tax-identity-is-not-public.db.test.ts`: the deadline joins the list of
  columns a signed-in stranger must NOT read.
- Guard: `tests/db/two-grants-a-browser-never-needed.db.test.ts` (9).

SPEC IMPACT: None
