## 2026-06-20 · feat(admin): confirm-guards on the money + adjudication actions (payments / payouts / disputes)

Wave 5 of the 2-step-down program — extends the #1880 confirm-guard pattern to the highest-severity remaining admin actions, the ones the audit named ("a wrong approve marks paid, a refund is an irreversible money event"). All six fired raw (single submit, no confirmation).

Wrapped in the shared `ConfirmForm` (each keeps its own inputs + a specific consequence message):
- **`admin/payments`** — **Approve** (marks paid → receipt + payout release + SKU unlock), **Reject** (cancels the order + revokes access), **Refund** (irreversible: marks refunded, revokes access, notifies the couple).
- **`admin/payouts`** — **Mark paid** (vendor money out + confirmation email), **Place on hold** (freezes the payout; no auto-release in V1).
- **`admin/disputes`** — **Apply resolution** (final adjudication, audit-logged, binds the parties).

Deliberately NOT touched this pass: the cost/VAT *preview* computations (amount-match pill, VAT "customer pays" line) — those need an exact-parity rebuild and are pricing-pass territory.

Deferred (clear next slice): the `admin/verify` vendor-status guards (approve/reject/demote/archive) + the `admin/pricing` Save-all / Create-bundle guards.

tsc 0; grep-verified 0 raw `<form>` left on the six guarded actions. No schema change.

SPEC IMPACT: admin console safety (iterations 0023 / 0034). Logged in `DECISION_LOG.md`.
