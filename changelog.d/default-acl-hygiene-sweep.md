## 2026-07-30 · fix(security): six tables were reachable by `anon` with the full default ACL — including TRUNCATE

Every table created in `public` inherits a default ACL granting `arwdDxtm` to **both** `anon` and `authenticated`. The Supabase anon key is public by design, so any browser can act as `anon`. Six tables shipped without the `REVOKE` every migration is meant to carry, leaving RLS as the **only** thing between an anonymous request and them.

**Verified against live production before writing** — not inferred from migration files, which have recorded things as applied that never landed:

| Table | `anon` held |
|---|---|
| `communities` · `community_members` · `community_invite_tokens` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `people` · `person_connections` · `person_stewardships` | same |

All six. Including `TRUNCATE`, to anonymous.

**The fix:** `REVOKE ALL` from both principals, then grant back `SELECT, INSERT, UPDATE` to `authenticated` only — the three verbs the shipped paths actually use (create a samahan, join via invite token, rename or archive one). No `DELETE` or `TRUNCATE`: `communities.archived` is a soft-retire flag, so the product deletes by archiving and the privilege isn't needed. No `REFERENCES` or `TRIGGER`: unused by application code, and both let a caller attach objects to a table it doesn't own.

**Exposure baseline regenerated in the same commit: 715 → 709 privilege facts.** The six `anon` lines are gone and `authenticated` is narrowed from the full ACL to `SIU`.

Worth noting the baseline did *not* force this — the freeze passes narrowings by design, so the check was green either way. Regenerating anyway is the point: a baseline still listing privileges that no longer exist is stale in exactly the way six health findings and four schema references were stale, and staleness that nothing forces you to fix is the kind that lasts.

**Two things deliberately NOT in this PR:**

`person_connections` has a real forgery hole — a single `FOR ALL` policy lets either side both create *and* confirm a relationship, so a declaration can be forged and self-approved. Fixing it edits `USING`/`WITH CHECK` predicates, which is counsel-gated and belongs in its own PR. Grants and predicates are separate concerns; mixing them widens this PR's blast radius for nothing.

`person_transfer_audit` is absent. An earlier plan listed it as probable — it appears in **no migration and no production snapshot**. It doesn't exist, and a `REVOKE` against a missing table would just fail the migration.

**Behaviour change: none.** Every one of these tables is either empty or already RLS-guarded. The person spine additionally sits behind `NEXT_PUBLIC_PEOPLE_CONNECTIONS`, which is off, at zero rows — which makes now the cheapest possible moment to correct a grant. This narrows what is *possible*, not what happens.

SPEC IMPACT: `DECISION_LOG.md` row — default-ACL hygiene applied to the Samahan trio and the person spine; the `person_connections` `FOR ALL` forgery hole is recorded as open and counsel-gated. No schema change, no policy predicate edit, no flag.
