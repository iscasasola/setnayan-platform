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
