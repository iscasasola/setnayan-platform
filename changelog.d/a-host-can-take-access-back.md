## 2026-09-09 · fix(access): a host can share, and take back, a coordinator's access

`event_moderators` had RLS on, five live rows in production, and exactly one
policy — SELECT — while `authenticated` held INSERT/UPDATE/DELETE grants with
nothing behind them. Granting threw a raw database sentence at the host; revoking
matched zero rows, returned no error, and reported success. A host who took the
guest list back kept handing it over.

Adds the three write policies, scoped to the couple-only helper — never
`current_event_ids()`, which admits any event member including a guest — and
stops both actions treating `error === null` as proof that anything changed.

SPEC IMPACT: applied — `DECISION_LOG.md` 2026-09-09.
