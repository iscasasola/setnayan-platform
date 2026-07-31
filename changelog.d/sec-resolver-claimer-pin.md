## 2026-07-30 · fix(security): `resolve_or_claim_person` was anon-callable and trusted its `p_claimer` argument as an identity

`public.resolve_or_claim_person` is `SECURITY DEFINER` — it writes `public.people` past that table's owner-only RLS, by design, so the users/guests trigger paths can seed person nodes. Its defining migration (`20270514555975`) carried **no `GRANT`/`REVOKE`**, so it inherited the PostgreSQL default of `EXECUTE` to `PUBLIC`, and PostgREST publishes it.

**Two distinct defects, and only fixing one leaves the hole open.**

1. **Reachability.** `anon` — the publishable key alone, no session — could call a definer function that writes a PII table.
2. **Trusted parameter.** The body never compared `p_claimer` against `auth.uid()`. A caller could nominate **any** account as the claimer of a person node. `claimed_by_user_id` is the link between a person row and the account that owns it, so this is an identity assertion accepted from an untrusted argument.

**The blast radius was checked before choosing the fix, not after.** Every call site at `origin/main` `c273ae015`:

| Call site | Args passed |
|---|---|
| `dashboard/(account)/people/actions.ts:62` | `p_email`, `p_creator` |
| `dashboard/(account)/people/actions.ts:236` | `p_email`, `p_creator` |
| `generate_event_connections` (`20270515967165:118`) | `p_email`, `p_creator` |

**Nothing in the codebase passes `p_claimer`.** So the guard is a no-op for every current caller and cannot regress a live path — which is what makes this safe to land on its own.

**Why not simply revoke to `service_role`.** The two live callers reach this through the **RLS client as `authenticated`**, so a service-role-only grant would break the People connect flow. The grant therefore keeps `authenticated`, and the identity check moves into the body where it belongs.

**What landed:**

- `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated, service_role`, mirroring the sibling lockdown at `20270515967165:147-148`.
- The claimer check **inline** as the resolver's first statement. `NULL` claimer passes (the only shape any caller uses); a JWT-less context passes (`service_role` and trigger paths, which have no `auth.uid()`); admins are exempt; anything else raises `42501`.

**The exposure freeze caught the first draft, and the lesson generalises.** That draft extracted the check into a small `public.assert_claimer_is_caller()` helper. CI failed:

```
✗ func public.assert_claimer_is_caller(p_claimer uuid)
    added: exec=anon,authenticated
```

Note **`anon`** — despite a `REVOKE ALL … FROM PUBLIC` in the same migration. Supabase's default privileges grant `EXECUTE` to `anon`/`authenticated` **explicitly** on new functions in `public`, and revoking from `PUBLIC` does not remove an explicit role grant. This is the default-ACL exposure that produced the 368-table sweep, applied to functions rather than tables.

Adding `REVOKE … FROM anon` would have worked. Inlining is better: **a security fix should not widen the published surface in order to close a hole.** No new grantable object now exists.
- The resolver body is the **shipped body reproduced verbatim** plus that one statement — verified by diffing the extracted function against `origin/main`, which shows only the three added lines. From here on this file is the live definition.
- A post-condition `DO` block that **fails the migration** if `PUBLIC` still holds `EXECUTE` after the replace. `CREATE OR REPLACE FUNCTION` preserves an existing ACL, so the revoke survives — but a silently-restored `PUBLIC EXECUTE` is precisely the defect being closed, so it is asserted rather than assumed.

**Not closed here, deliberately.** `anon`/`authenticated` still hold direct `UPDATE` on `public.people`, and `people_owner_all`'s `WITH CHECK` admits a `created_by_user_id = auth.uid()` leg. That is a separate lane with its own blast radius and gets its own PR — bundling it would make this one unreviewable.

SPEC IMPACT: None. No product behaviour changes; no surface, copy, price or flag moves. Security posture only.


## 2026-07-31 · the review that found two defects in this PR

CI turned this from a clean lockdown into a corrected one. Four `creator-loop.db.test.ts` tests failed with **this migration's own exception**, and chasing that surfaced a second, worse problem.

### 1 · The header's central claim was false

It said *"NOTHING in the codebase passes p_claimer"* and *"trigger paths are unaffected."* Both wrong.

`ensure_person_for_user` — the **signup trigger**, `AFTER INSERT ON public.users` — passes `p_claimer => NEW.user_id`. It sits **fourteen lines below** the resolver this file audits, **in the same migration**. The audit read the function and stopped before the trigger under it.

The "triggers are unaffected" reasoning conflated **privilege** with **identity**. `SECURITY DEFINER` changes the privileges a body runs with; it does not change `auth.uid()`, which is a session GUC. Inside that trigger `auth.uid()` is whoever holds the connection while `p_claimer` is the new row's id — on any connection carrying a user JWT those differ, and the guard fires. In the tests that meant four red suites. In a production shape where a user session inserts a `public.users` row, it would mean **signup itself throwing 42501**.

Fixed with one conjunct: `pg_trigger_depth() = 0`. The guard exists for the **direct PostgREST surface**, which is always depth 0. It weakens nothing — the one trigger that reaches here hardcodes `p_claimer := NEW.user_id` on a row whose `user_id` is already pinned by `public.users`' RLS `WITH CHECK (user_id = auth.uid())`, so that path cannot nominate a third party even in principle.

### 2 · §1 did not close the lane §1 claimed to close

`REVOKE ALL … FROM PUBLIC` does **not** remove `anon`'s explicit grant. §2 of this very file has explained that since the first draft — and §1 relied on the PUBLIC revoke anyway.

Measured in prod, on the exact sibling this migration says it *"mirrors"* (`20270515967165:147-148`, the same two lines):

| function | `public` | **`anon`** | `authenticated` |
|---|---|---|---|
| `generate_event_connections` | false | **TRUE** | true |

The PUBLIC revoke worked and **anon kept executing.** Without a fix this PR ships the identical hole — under a §3 post-condition that only inspected `has_function_privilege('public', …)`. **Green migration, lane open.** The exposure freeze would not have caught it either: nothing widened.

Three changes: `REVOKE … FROM anon` on the resolver; the same on `generate_event_connections`, which is anon-executable in prod **today** for the identical reason (a hole you have measured and left open is a decision, not a backlog item); and a post-condition that asserts the **roles** — PUBLIC *and* anon — plus a positive control that `authenticated` did **not** lose EXECUTE, so a narrowing can never silently break the live caller.

Regenerated baseline, narrowings only:

```
-func public.generate_event_connections(…)  exec=anon,authenticated
+func public.generate_event_connections(…)  exec=authenticated
-func public.resolve_or_claim_person(…)     exec=anon,authenticated
+func public.resolve_or_claim_person(…)     exec=authenticated
```

### Honest scope of the body guard

It closes *"nominating a **third party** as claimer."* It does **not** stop an authenticated attacker calling with a victim's email and `p_claimer = their own uid` — that passes the guard and is blocked only incidentally by `people.claimed_by_user_id UUID UNIQUE`, since an attacker already owns a node minted at signup. A UNIQUE constraint doing authz work is worth knowing about; it is not this PR's job to fix, and this PR should not be described as closing it.

**Verified:** 659 DB tests · 5,681 unit tests · 0 failures. `tsc` clean. Exposure freeze, baseline lint, dup-rule, migration-doctor and timestamp guards all exit 0.
