## 2026-07-01 · fix(vendor/security): lock immutable partnership columns (P4 hotfix)

Closes an RLS forged-endorsement hole introduced by the mutual-accept redesign
(migration 20270403305164, PR #2483). RLS `WITH CHECK` can't compare OLD-vs-NEW,
so the recipient accept/decline policy left `recommending_vendor_id` /
`relationship_type` / `target_id` / fee / discount / `covered_plan_groups`
mutable. Since public visibility now hinges on the recipient-settable
`status='accepted'` (not the admin-only `admin_verified`), a recipient could
repoint a genuine incoming proposal to name any prestige vendor as recommender
and self-publish a forged endorsement in Explore.

- Migration `20270405045663` — a `BEFORE UPDATE` trigger
  (`vendor_partnerships_lock_immutable_cols`) that, for non-admins, rejects any
  change to the counterparty ids, relationship type, target, or commercial
  terms. Non-admins may still move `status`/`accepted_at`/`is_active` (their own
  RLS-gated transition); admins may correct anything. Idempotent.

Both P4 migration + this fix are unapplied on prod as of writing, so they apply
in one `db push` (hole opened then immediately closed — no external window).

SPEC IMPACT: None.
