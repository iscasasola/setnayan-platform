## 2026-08-17 · fix(security): the second lock — batch 4, 21 tables no signed-out visitor can reach

**70 of 180 closed** (16 · 17 · 16 · 21). anon SELECT **257 → 236** of 384.
🟢 Nothing is leaking; no client's answer changes.

## The third refinement of gate 4

Batches 1–2 took every table with **no query at all**; batch 3 every table queried
**only by the service role**. Both exhausted, so the question moved again: *can a
signed-out visitor's code path reach it?* All 21 are queried exclusively from
inside the login-gated trees (`app/dashboard/**`, `app/vendor-dashboard/**`). A
signed-out visitor is redirected out; a signed-in one is `authenticated`, never
`anon`.

🔒 **The redirects were read, not counted** — `if (!user) redirect(loginRedirectPath(...))`.

🚨 **"Behind a login" is not sufficient on its own**, and this is the trap that
nearly carried the batch: a **server action is a POST endpoint and the gating
layout never runs for it**. Every action file was opened. All establish the caller
first — most via `auth.getUser()`; `seating/walkthrough` and `guests/souvenirs` via
`getCurrentUser()` plus an `event_members` check.
⚠ My first *verification* grep omitted `getCurrentUser` and reported those two as
unguarded. The original scan was right and the **check** was too narrow — the
instinct "the scan was wrong again" was itself wrong.

Two re-read by hand because earlier notes claimed a wider reach:
`event_category_build_state` (the couple marketplace does read it every page load —
inside the gated tree) and `papic_missions` (guest-facing product, but all eight
query sites are under the couple's studio).

⏭ Three qualifying tables **held back** to batch 5 — `platform_compliance_facts`,
`vendor_recommendation_feedback`, `vendor_review_appeals` — queried from the ADMIN
tree, a different guard (`requireAdmin()`), and one of their files is being edited
by open PR #4519. *A migration is judged against the state it lands in.*

## A new invariant: a revoke must never orphan a policy written FOR anon

Mutation testing found that nothing guarded the **inverse** break. Revoking a
table anon legitimately needs was covered by exactly **two hard-coded names**,
added after batch 2 nearly emptied the public supplier listing — a list, not an
invariant.

🔑 **The invariant is derivable:** if a table carries a policy that can admit
`anon`, somebody wrote a rule for anonymous visitors; revoking the grant makes
that policy **unreachable**. ~96 tables are covered with no list at all.

⚠ **Column-aware on purpose.** `has_table_privilege` is FALSE when only *some*
columns are granted, and six tables here are deliberately column-scoped. The
table-level check reported `event_paperwork` and `vendor_profiles` as broken when
both are correct; `has_any_column_privilege` is the right question.

It surfaced a **pre-existing finding**: five tables (`event_category_decisions`,
`papic_event_pool_config`, `people`, `person_connections`, `person_stewardships`)
carry an anon policy with **no grant at all** — rules that can never fire. Not
caused by any batch; baselined with reasons.

## Verification

Dry-run in a rolled-back transaction: 21 → 0 on SELECT and TRUNCATE; controls
unmoved; column-ACL 376 → 376; marketplace still readable; **guest-tree tables kept
their grant (4 → 4)**; prior batches still closed. All 21 confirmed still granted
after ROLLBACK.

Six mutations, counts printed before → after:

| mutation | result |
|---|---|
| drop one REVOKE (`papic_missions`) 1→0 | ✅ red, naming it |
| revoke `guests` (no anon-reaching policy) 0→1 | ✅ **green, correctly** — RLS already denies anon there, so it is behaviour-neutral |
| empty batch 4's list 21→0 | ✅ red on META |
| revoke `creator_chapters` (HAS an anon policy) 0→1 | ✅ red on the new invariant |
| revoke `event_paperwork` (column-scoped) 0→1 | ✅ red — a table-level revoke drops column grants, genuinely orphaning the policy |
| empty the allow-list 5→0 | ✅ red, naming all five |

Exposure freeze 6/6 · guard 6/6 · typecheck clean.

⏭ The remaining ~110 are queried from outside the gated trees — shared helpers with
an injected client, public routes, and the guest tree where `anon` is the ordinary
case and the grant is genuinely load-bearing. There is no fourth shortcut.

SPEC IMPACT: None.
