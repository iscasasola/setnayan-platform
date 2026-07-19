## 2026-07-16 · feat(people): "Alaga" is the locked product name for the dependent surface

Owner-locked 2026-07-16: **Alaga** in all user-facing copy; **dependents** stays the technical/legal term (schema, RLS, counsel docs). Copy-only changes to the flag-gated dependent section (`NEXT_PUBLIC_DEPENDENT_PEOPLE` still off — nothing visible in prod):

- Section heading "The ones you care for" → **"Alaga"**, with the old phrase folded into the sub-line, which now also states the ownership model in owner's words: the profile lives inside your account and belongs to you; a child's becomes their own at 18.
- Add-form title "Add someone (or a pet)" → "Add an alaga"; fallback row label "Someone I care for" → "My alaga".
- Component doc comment records the name lock and the account-creator framing (an alaga profile = an account created inside your account; only a person's can later be claimed as their own login at 18).

No schema, logic, or behavior changes.

SPEC IMPACT: DECISION_LOG.md 2026-07-16 row (Alaga name lock — product name Alaga / technical term dependents)
