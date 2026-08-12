## 2026-08-12 · fix(orders): a couple writes their own three ledger events, on their own order — not "service activated"

Eighth and last finding from the 2026-08-11/12 authority-column sweep.

Unlike its seven siblings this table is browser-writable **by design**:
`order_ledger` is append-only evidence and the couple's checkout legitimately
writes to it under their own session (`checkout/actions.ts:894, 904, 918` — the
*only* RLS-client `appendLedger` call sites; all fifteen others pass the
service-role client). What was missing was any constraint on **which row** and
**which event**:

```
order_ledger_authenticated_insert  WITH CHECK (actor_user_id = auth.uid())
```

That pins who is writing and nothing else.

| | before | after |
|---|---|---|
| couple writes `service_activated` on their own order | **ACCEPTED** | refused |
| couple writes `payment_approved` / `order_refunded` | **ACCEPTED** | refused |
| couple signs a line `actor_role='admin'` or `'system'` | **ACCEPTED** | refused |
| couple writes onto **somebody else's** order | **ACCEPTED** | refused |
| the three checkout verbs, on their own order | worked | **still works** |
| service-role writes every verb | worked | **still works** |

### Why a forged row is not just a false audit line

The ledger is **machine-read**. Four activation paths in `lib/sku-activation.ts`
(~364, ~488, ~584, ~662) each run
`.eq('event_type','service_activated') … if (prior) return;` as an idempotency
guard, so a replayed webhook cannot activate twice.

Planting that row against your own order **before paying** therefore makes the
real activation short-circuit: the couple pays, the admin approves, and the thing
they bought silently never switches on. No error for anyone to see — the guard
did exactly what it was written to do, on a lie.

The unconstrained `order_id` is the quieter half: an order id seen in a receipt,
a URL or a support thread was enough to write onto a stranger's order.

⚠ **A second consequence is reported but NOT verified.**
`deactivateVendorAddonWindow` (~1574) is said to read the latest
`service_activated` row's forgeable `metadata` to decide a refund-time rollback,
which would let a far-future stamped expiry make the rollback a no-op — money
back, entitlement kept. The four short-circuits above are confirmed by reading
the code; that one is not, and the fix closes it either way, so it is recorded as
a claim rather than asserted as fact.

### Why a policy and not a grant

`event_type` is NOT NULL with no default and the couple's client legitimately
names it — three of the eight verbs are genuinely theirs — so there is nothing to
derive and a revoke would break checkout loudly. Same call as `status` on
`vendor_verification_applications` (`20271135231726`): **the control follows what
the legitimate code has to send.**

The new `WITH CHECK` admits precisely what checkout sends: the caller's own uid,
`actor_role='couple'`, one of the three couple verbs, and an order the caller
owns (mirroring `order_ledger_couple_read_own`, so read and write scope agree).
UPDATE and DELETE were revoked back in `20260529020000` and stay revoked —
append-only is intact and nothing here loosens it.

The `event_type` CHECK constraint is deliberately **not** narrowed: the
service-role paths still write all eight verbs, and narrowing the constraint
instead of the policy would break them while making these tests pass for the
wrong reason. A META test asserts the CHECK still admits all eight.

**Guards.** New `apps/web/tests/db/order-ledger-couple-lane-only.db.test.ts` —
11 tests: anti-vacuity META (one reads `sku-activation.ts` and asserts the
short-circuit still exists, because the severity rests on it; the policy pins
order, verb and role; UPDATE/DELETE still revoked; the CHECK still admits all
eight; real unprivileged probe role), behavioural coverage of all six rows above,
and a NEUTRALISATION test that restores the one-line policy and asserts **all
four holes re-open at once**.

`supabase/security/exposure-surface.baseline.txt` regenerated — a single policy
line, strictly narrowed, nothing else moved.

Prod: **0** `order_ledger` rows.

SPEC IMPACT: None. The ledger's documented contents and append-only posture are
unchanged; the couple's lane is now the size it was always described as.
