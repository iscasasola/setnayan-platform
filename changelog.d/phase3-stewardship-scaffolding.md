## 2026-07-05 · feat(people): Phase-3 stewarded-accounts INERT scaffolding (counsel-first)

Step 1 of the stewarded ("branch") accounts design — empty, additive, deny-by-
default schema ONLY. Ships NO behavior, NO triggers, NO functions, NO data
processing. A guardian branch cannot be created and no transfer can occur from
this schema alone.

- `person_stewardships` — who stewards a branch people-node (kind guardian/estate,
  is_minor wall-off flag, status, granted/ends/relinquished/revoked). RLS
  deny-by-default: steward-or-admin only.
- `stewardship_transfers` — append-only audit of a future ownership transfer
  (majority/inheritance/revocation). RLS: participant/admin READ only; no
  UPDATE/DELETE; INSERT reserved for the counsel-cleared flow.
- `lib/stewarded-accounts.ts` — reserves the OFF `NEXT_PUBLIC_STEWARDED_ACCOUNTS`
  flag + types. No consumers yet.

Validated in a rolled-back prod transaction: both tables created, RLS enabled on
both, 2 policies, 0 rows. Nothing persisted.

⚠ COUNSEL-FIRST: Phase 3 touches MINORS + POST-MORTEM/SUCCESSION law. The actual
guardian/transfer flow stays UNBUILT until PH counsel + DPO (Claire E. Buanhog)
sign off and the minors + post-mortem DPIAs are done. Ownership itself lives on
`people.claimed_by_user_id`; these are records + audit. Same inert posture as the
Phase-2 schema that shipped ahead of its flow.

SPEC IMPACT: None (implements Step 1 of the already-designed Phase 3, per
`03_Strategy/Stewarded_Branch_Accounts_Phase3_Design_2026-07-05.md` §6).
