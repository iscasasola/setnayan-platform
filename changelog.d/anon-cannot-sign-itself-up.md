## 2026-08-28 · fix(security): close the three anonymous-write doors that nothing walks through

An audit of `anon` INSERT exposure across every table in `public`, measured by
**execution** rather than by reading policies.

**What was measured** (prod, in rolled-back transactions): 391 base tables, RLS
on for all 391. `anon` — the role behind the publishable key that ships in every
page's source — holds INSERT on **197**, SELECT on 204, UPDATE on 198, DELETE on
203, TRUNCATE on 205.

⚠ **A FIGURE IN CIRCULATION IS WRONG AND IS CORRECTED**: *"361 of 368 tables
grant SELECT+INSERT to anon"*. It is about **half**, not 98%. That number was
quoted from a memory note into at least one migration docblock, and it overstated
the posture by roughly 2×.

**The part nobody had measured**: a grant only matters if a policy admits the
role. All 197 anon-INSERT tables were probed as `anon` — one generated INSERT
each, naming only NOT NULL / no-default columns:

- **193 refused, SQLSTATE 42501** — RLS. The grants are inert.
- **4 admitted** — every signup/contact form in the product.

**Three of the four have no anonymous caller at all** and are closed here
(migration `20271178066835`): both notify-signup tables are written by server
actions through the **service role**, which bypasses RLS entirely, and
`couple_waitlist_signups` has **no writer anywhere in the codebase**. All three
hold **zero rows**.

**The fourth stays open, deliberately.** `help_messages` is the public Help
contact form; `app/help/actions.ts` posts it through the **visitor's own
session**, and a signed-out visitor's session is `anon`. A post-condition and a
positive-control test both fail if it is ever narrowed by accident.

⚖ It is more than hygiene: all three closed tables are in the RA 10173
data-subject register — email, full name, partner name, IP address, user agent.
An anonymous INSERT on personal data, reachable with a published key and written
by nothing, has no legitimate traffic.

**TRUNCATE, settled explicitly:** `anon` holds it on 205 tables and TRUNCATE is
**not subject to RLS**, so it is safe only because nothing exposes it. Checked,
not assumed — of 278 functions `anon` may execute, **zero** SECURITY INVOKER
functions mention TRUNCATE, and the two SECURITY DEFINER matches are the word in
**prose comments**. PostgREST exposes no TRUNCATE verb.

⛔ **No blanket revoke sweep.** 193 of the 197 grants are already inert; mass
revoking risks breaking a legitimate signed-out path exactly like the one kept.

🪤 **The measurement trap, recorded because it will recur:** `vendor_services`
first came back **23514**, which reads as *"passed RLS, rejected on data"* — a
live hole. It is not one. **A BEFORE INSERT trigger runs before the RLS WITH
CHECK**, and what fired was the publish gate added hours earlier. Re-probed with
a DRAFT row, which that trigger does not judge: refused, 42501. *A non-42501
error does not prove RLS admitted you.*

🪤 **And mutation testing found a hole in my own guard.** Dropping the
replacement policy outright — closing the door on `authenticated` too — passed
every test AND the migration's own `authenticated` post-condition, because that
condition asks `has_table_privilege`. **A GRANT IS NOT A POLICY**: the role keeps
the privilege and RLS still refuses it. Only a real INSERT tells them apart;
there is now a signed-in differential control that does exactly that.

**Measured** · migration dry-run against **production** inside `BEGIN … ROLLBACK`
— all five post-conditions passed, the three doors refused anon with 42501,
`help_messages` still accepted, prod verified unchanged afterwards · typecheck 0
errors (exit 0) · 10 db tests · 4 mutations, each measured by occurrence count
before → after, all RED · exposure baseline regenerated: **6277 → 6274 facts**,
a pure narrowing (3 table grants dropped, 28 columns `anon=SIU` → `anon=-` with
`authenticated=SIU` unchanged, 3 policies losing their anon arm, **zero
additions**).

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28; the "361 of 368" figure in the
default-ACL memory note is superseded by the measured 197 of 391.
