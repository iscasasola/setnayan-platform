## 2026-06-20 · feat(checkout): one-tap copy for the payment amount, reference code, and account numbers

2-step-down program (Wave 6) — the apply-then-pay order page makes the couple hand-copy four values into their banking app, and a mistyped reference code breaks the automatic reconciliation. They can now copy each with one tap.

- **`app/_components/copy-button.tsx`** (new shared) — generic copy-to-clipboard button (`value` + `label`, with an `aria-label` and a graceful no-op if the clipboard is blocked). Near-identical buttons predate this in studio/papic/crew + panood; left for a later fold-in.
- **`orders/[orderId]/page.tsx`** — copy buttons on the payment amount, the **reference code** (the error-prone exact-match value that drives auto-matching), and the BDO + GCash account numbers in the payment-instructions block.

Scope: just the copy affordance. The pre-minted reference code + a couple-facing status timeline (the rest of this surface's program levers) were flagged non-trivial (order lifecycle state) and are deferred.

No schema change. tsc clean.

SPEC IMPACT: iteration 0034 checkout UX. Logged in `DECISION_LOG.md`.
