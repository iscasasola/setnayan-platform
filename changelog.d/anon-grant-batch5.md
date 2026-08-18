## 2026-08-18 · fix(security): batch 5 — the five tables where the key opened nothing

Closes the "no policy at all" category completely. Each of the five has row-level
security ENABLED and ZERO policies, so Postgres already denied anon everything —
the grant was a key to a bricked-up door. Nothing observable changes.

Gates, each run independently rather than inherited from another session's reasoning:
RLS + zero policies (pg_class/pg_policies) · no `security_invoker` view reads them,
with the query PROVED able to match by running it against the two tables batch 2
rescued · not queried from any public or guest tree · nothing created here, so no
grant is reset.

🪤 One apparent public-tree hit on `drive_copy_artifacts` is a COMMENT, not a query.
A grep count said "1 file"; reading the line said zero. Read the line, not the count.

⏭ AFTER THIS, EVERY REMAINING CANDIDATE HAS POLICIES THAT MERELY EXCLUDE ANON —
a different question, because the app reaches many of them through the service role.
Those cannot be swept; they are one at a time.

SPEC IMPACT: None.
