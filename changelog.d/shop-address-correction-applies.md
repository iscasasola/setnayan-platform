## 2026-08-12 · fix(db): the shop-address correction migration was REJECTED BY PROD — and every local check was green

`20271132819490` merged with 18 green checks and **never reached the database**:

```
ERROR: permission denied to set parameter "setnayan.allow_slug_change" (42501)
```

It declared the escape hatch as a **function-level** `SET` — the textbook way to
scope a setting to one call. That clause is validated **at CREATE time** and
needs `SET` privilege on the parameter; Supabase's `postgres` role is not a
superuser and does not hold it for a custom placeholder.

🔑 **THE REPLAY DATABASE IS MORE PERMISSIVE THAN PRODUCTION.** The PGlite replay
every `*.db.test.ts` runs against executes **as a superuser**, so it happily
created a function prod refuses. 8 db tests, typecheck, 18 CI checks, merged —
rejected on the way in. Add *"the test database allowed what prod forbids"* to
the family with the phantom column, enum value, RPC argument, blocked iframe and
wrong catalog.

✅ **The deploy gate did its job.** `deploy-prod` is migrate-then-deploy: the
Vercel step was **skipped**, so the app half was held back with the schema half.
The feature existed in neither half — no live broken button.

**The fix, verified against prod before pushing.** Setting the parameter *at
runtime* is unrestricted (measured). The hatch is now opened with
`set_config(..., is_local := true)` around **one UPDATE**, and the caller's own
prior value is **restored on every exit path**, including from an exception
handler before re-raising — restoring the previous value rather than forcing
`off`, so a caller who deliberately opened the hatch is not slammed shut by a
function it called in the middle.

⚠ `SET LOCAL` in the body was **not** the answer either: it lasts to the end of
the **transaction**, so the hatch stays open for whatever the caller does next.

🛡 **A new guard, because no db test can catch this** — the environment that
would notice is the one that permits it. `lint-no-function-level-custom-set.mjs`
fails any migration reaching for the construct again, and warns on `SET LOCAL`.
Wired into `ci.yml` with **all three** required edits (step id, env binding,
`check` call) — miss one and a guard runs but can never fail the job.

**Proved, not argued:** the whole migration was dry-run **against production**
inside a transaction and rolled back — `DDL ACCEPTED BY PROD`, then confirmed
prod was left untouched. Guard verified green, then red on the exact rejected
construct. The hatch-leak test re-verified: dropping the restore turns it red
*and contaminates every later test in the file*.

SPEC IMPACT: None (the decision was already logged; this is its delivery).
