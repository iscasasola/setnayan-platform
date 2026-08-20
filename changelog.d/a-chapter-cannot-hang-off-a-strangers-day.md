## 2026-08-20 · fix(security): a chapter cannot hang off a stranger's day, and the author cannot put it there

🚨 **PROVEN AGAINST THE LIVE DATABASE, in a rolled-back transaction.** As the
`authenticated` role carrying one test account's own token, production ACCEPTED
an INSERT that named **somebody else's wedding** in `event_id` and stamped
`host_included_at` in the same statement. Both forged values stuck. That put

- that wedding's **booked suppliers** on a stranger's public chapter page
  (the chapter page derives them from the attached celebration), and
- the stranger's chapter **where Setnayan speaks about that wedding** (the
  cross-rail chip), which is the exact harm `host_included_at` was added to
  prevent.

🔑 **WHY THE EXISTING GUARD COULD NOT FIRE — A COLUMN-LEVEL REVOKE CANNOT
SUBTRACT FROM A TABLE-LEVEL GRANT.** The 2026-08-15 migration did
`REVOKE UPDATE (host_included_at) … FROM authenticated`, which is the right
instinct; but `authenticated` holds **table-level** INSERT/UPDATE on this table,
and that covers every column. Measured after the revoke shipped:
`has_column_privilege('authenticated','creator_chapters','host_included_at','UPDATE')`
= **TRUE**. Add it to the family of controls that look present and are not.

🔑 **AND A UNIT TEST PINNED THE REVOKE BY READING THE MIGRATION'S TEXT**, so it
was green for five days over a control that did not exist. **A guard can match a
string instead of the act.** That assertion is retired; the proof is now eleven
real writes under a real `SET ROLE authenticated`.

🔑 **THE TRIGGER MISSED IT TWICE OVER:** it fired `BEFORE INSERT OR UPDATE OF
event_id`, so an UPDATE naming only `host_included_at` never reached it; and on
INSERT it only ever *set* the value when it was NULL — it never CLEARED one the
author submitted.

**The fix:** one trigger, on every insert and update, that (a) refuses a browser
write naming a celebration the author neither hosts nor was booked on, and
(b) never lets a browser write `host_included_at` at all. The service role — our
own server actions, where the host's "put this on / take this off my day" lives —
is trusted, deliberately.

🪤 **TWO WRONG DRAFTS, BOTH CAUGHT BY MEASURING RATHER THAN READING:**
1. `current_user IN ('authenticated','anon')` **inside a `SECURITY DEFINER` body
   is the FUNCTION'S OWNER, not the caller** — false for everybody, so the first
   fix was inert and prod still accepted the forgery.
2. Moving the lookups into a DEFINER helper made the trigger INVOKER — but a
   helper must be granted to `authenticated`, and PostgREST then publishes it at
   `/rest/v1/rpc/` as an oracle answering *"is user X tied to event Y?"* for any
   pair. **`exposure-freeze.db.test.ts` caught that**, with a better explanation
   than the code had. ✅ What survives the definer boundary is
   `current_setting('role')` — measured: `authenticated` under PostgREST's
   per-request SET LOCAL ROLE, `service_role` for our own actions, `none` for a
   migration. No new function, no new surface, both baselines untouched.

🪤 **AND WIDENING THE TRIGGER NEARLY BROKE THE HOST'S OWN CONTROL.** Running on
every update re-ran "the author is the host ⇒ included", so the next title edit
silently put a chapter back on a day the host had just taken it off. Auto-
inclusion now only happens as the link is MADE. Found by probing the host's
remove-then-edit path, not by reading the diff.

**Verification**
- **7 outcomes proven against production** (rolled back) with the exact shipped
  function: forge-on-insert REFUSED · own celebration accepted + auto-included ·
  re-point REFUSED · author's self-stamp ignored · host removes it (works) · a
  later edit does NOT put it back · host puts it back (works).
- **11 db tests** doing real writes under `SET ROLE authenticated`. **6 of the 11
  fail on the code as it stands today** — all four forgeries plus both structural
  assertions; the other five are the legitimate paths, which must keep passing
  either way and do.
- 1279 db tests · chapter unit tests · 18 lint scripts · typecheck all green.

SPEC IMPACT: None. No product behaviour changes for anybody using the screens —
the composer already refused this; the database now refuses it too.
