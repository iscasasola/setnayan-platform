## 2026-07-02 · chore(db): Locked QR — money-sanity CHECK constraint (defense-in-depth)

Backstops the app-layer validation in `issueLockedQr` with a DB constraint on
`vendor_locked_qr_tokens`, so a direct RLS insert (bypassing the action) can't
persist a token whose downpayment exceeds its total or whose total is ≤ 0.

Migration `20270428737939`:

```sql
CHECK (total_php IS NULL OR (total_php > 0 AND initial_paid_php <= total_php))
```

`total_php` stays NULLABLE (legacy tokens + the claim RPC COALESCE on it), so the
check only bites when a total is present. Added **NOT VALID** — guards every
future INSERT/UPDATE without validating existing rows, so it can't fail on any
pre-existing data. Idempotent (DROP CONSTRAINT IF EXISTS + ADD).

SPEC IMPACT: None (integrity constraint only; behavior already enforced in-app).
