## 2026-11-19 · fix(admin/payments): a failed auto-match release is retried, listed and audited

- **Blocker from the #7940 review.** `releaseDueHolds` claims `released_at` before it runs the approve, and `approvePaymentCore` throws on a DB error. A throw left the payment `pending` with `released_at` set: never retried, off the held list, hand Match said "Undo it first", Undo said "confirmed", no audit row. Now the approve is wrapped: on a throw the payment is re-read; still pending (or unreadable) → the claim is put back so the next run retries it, a `payment_auto_match_release_failed` audit row is written, and the loop goes on to the next hold. The job run then records ok=false. A payment that flipped to `matched` before the throw keeps its claim, so it can never be approved twice.
- **Shortfall / not-promotable answers read honestly.** They were counted as "paid". They are now audited as `payment_auto_match_released_order_not_paid` (reason `shortfall` / `not_promotable`) and not counted. The payment stays matched, as after a human press.
- **GCash month total filtered in SQL** (`getGcashGate`): `.ilike('channel', '%gcash%')`, a superset of `isGcashRail`, so BDO rows no longer fill PostgREST's 1,000-row page. A full page fails to `null` (BDO), never a smaller total.
- **Migration header** of `20271352394900_received_auto_match_hold.sql` names its own file (it named `20271351549033`). Comment only; the migration is not applied in prod yet (checked `supabase_migrations.schema_migrations`).
- Test: `app/admin/payments/a-failed-release-is-retried.test.ts` runs the real `releaseDueHolds` / `readHeld` against an in-memory client.

SPEC IMPACT: None
