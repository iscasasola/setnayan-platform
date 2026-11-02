## 2026-08-11 · fix(security): close self-promotion to admin — the guard watched only one verb

**CRITICAL.** Anyone who signed up for a free account could make themselves a
Setnayan admin. Found by a sweep for client-writable authority columns run after
the two sender-forgery fixes the same day (`20271132839561` · `20271132843141`);
this is the same shape with a far worse blast radius.

Reproduced end to end in the full-corpus replay as an ordinary `authenticated`
customer session:

| step | before | after |
|---|---|---|
| `UPDATE users SET account_type='admin'` | silently reverted ✅ | silently reverted ✅ |
| `DELETE FROM users WHERE user_id=<self>` | **1 row deleted** | refused |
| `INSERT INTO users (…, account_type) VALUES (<self>,…,'admin')` | **ACCEPTED** | refused |
| `is_admin()` | **TRUE** | false |

`is_admin()` is `EXISTS (SELECT 1 FROM public.users WHERE user_id=auth.uid() AND
account_type='admin')`. It is trusted by ~298 RLS policies and by the `/admin`
gate in `middleware.ts`, so this was read/write of the entire platform — vendor
government IDs, guest face-enrolment records, payments. Signup is open, so a
stranger could do it. Prod has 8 users.

**Why the existing guard missed it.** `guard_users_privilege_columns` is correct
and does its job — it was attached `BEFORE UPDATE` only. Every escalation it was
written to stop was imagined as an *edit*, and a row can also be *replaced*. A
guard is only as wide as the verbs it fires on; DELETE+INSERT is a rename for
UPDATE that no correctness in the function body can catch.

**Why the policies did not stop it.** `user_owns_row` is PERMISSIVE **FOR ALL**
with `user_id = auth.uid()`, which covers DELETE and INSERT. Deleting your own
row and inserting your own row both satisfy it perfectly: the policy is about
*whose* row and never had an opinion about what is *in* it — precisely the shape
of the two forgery fixes it followed.

**The fix**, two halves, each proven separately in the test:

1. The guard now fires `BEFORE INSERT OR UPDATE`. On INSERT there is no OLD to
   restore from, so a non-privileged session simply gets an ordinary account:
   `is_internal`/`is_team_member` forced FALSE, `account_type='admin'` rewritten
   to `'customer'`. The UPDATE branch is untouched.
2. `authenticated` and `anon` lose INSERT and DELETE on `public.users`. Verified
   across all of `apps/web`: the only INSERT and the only DELETE anywhere are in
   `scripts/stress-test-lock-unlock.ts`, both service-role. Provisioning is the
   SECURITY DEFINER signup trigger; account deletion anonymises rather than
   deletes.

Revoking DELETE closes a second, quieter problem: 116 foreign keys reference
`public.users` and 29 CASCADE, so a user deleting their own row was destroying
data across the product with one request, quite apart from the escalation.

**🪤 A harness divergence this uncovered, worth knowing repo-wide.** Production
`auth.role()` is `coalesce(nullif(claim,''), claims->>'role')` and returns NULL
on a direct connection. The replay shim is `COALESCE(NULLIF(claim,''), 'anon')` —
it can **never** return NULL. The guard's `v_role IS NULL` branch, which is how a
migration, a superuser, or the SECURITY DEFINER signup trigger identifies itself
in production, is therefore **dead code in every db test in this repo**.

The first cut of this fix relied on it and silently stripped the § 10a owner
internal flag at signup — under test only, and it would have looked like success
everywhere else. The guard now also derives privilege from `current_user`, which
is true in both environments, and the tests assert the owner flag and vendor
signup outcomes so a repeat is caught by what a person would notice rather than
by reading the shim. The shim itself is left alone (changing it moves ground
under 1000+ existing tests) but is now documented and asserted.

**Guards.** New `apps/web/tests/db/users-privilege-escalation.db.test.ts` — 15
tests: anti-vacuity META (`is_admin()` still keys off `account_type`; the trigger
covers both verbs; `user_owns_row` is still FOR ALL; the probing role is a real
unprivileged session; `authenticated` keeps SELECT/UPDATE and `service_role`
keeps everything; and the `auth.role()` divergence asserted so a shim fix trips
it), behavioural coverage of the UPDATE route, the full DELETE+INSERT chain,
ordinary signup, **the § 10a owner flag** and vendor signup, plus three
NEUTRALISATION tests — re-grant and the trigger still refuses the promotion;
remove both halves and the escalation returns with `is_admin()` true; and one
proving a genuine admin session can still set these columns, so the fix has not
locked out the people it protects.

`supabase/security/exposure-surface.baseline.txt` regenerated — `public.users`
only, every line a narrowing, no widenings. Branch rebased onto current `main`
first.

SPEC IMPACT: None. No product rule, price, SKU or copy changes.
