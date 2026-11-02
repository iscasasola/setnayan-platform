### Reconcile orphaned `gift_notification_type` migration onto main

Lands `supabase/migrations/20270213450358_gift_notification_type.sql` — a one-line `ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'gift'` — onto main. The file already lives on the (draft) branch of [PR #2027](https://github.com/iscasasola/setnayan-platform/pull/2027) and was applied to prod ahead of that PR's merge, leaving the prod migration ledger with a version that had **no corresponding file on main**. That orphan jammed a clean `supabase db push` for every session.

Byte-identical to #2027's copy, so when #2027 eventually merges there is no conflict. Idempotent + already-applied, so `db push` will record it as present and skip re-running. No app code lands here — the `'gift'` enum value stays unused on main until #2027's feature code merges.

SPEC IMPACT: None (migration-ledger hygiene).
