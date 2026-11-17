## 2026-11-17 · feat(admin/payments): BDO exact matches hold 30 minutes, then pay — with Undo and an audit trail (phase 2)

Stacked on #7924 (phase 1). Owner rulings, specs DECISION_LOG 2026-11-17: exact
matches auto-approve (narrow exception to the 2026-07-11 rule); the conditions
are closed by "limits APPROVED, undo 30 minutes"; "a self-match HOLDS 30 minutes
then pays"; leftovers are matched by hand; all payments go to BDO via QR Ph.

- **Which rows match by themselves** — `lib/admin/received-auto-match.ts`, pure
  code: the buyer's reference is the WHOLE BDO reference or the FULL InstaPay
  invoice (every digit after the zero padding — never a shorter piece), the
  amount agrees to the centavo, exactly ONE unpaid payment names the transfer
  and exactly ONE received row names the payment, and the money is not earlier
  than the order. Anything else stays in the hand-match pile.
- **The hold** — a drop records each exact match (`match_kind 'auto'`) and pays
  nothing. After 30 minutes the `received-auto-match-release` job (admin
  traffic, 5-minute claim) runs the same `approvePaymentCore` a Match press runs.
- **Undo** — inside the 30 minutes, on Focus and Admin › Payments. The payment
  was never touched; the received row goes back to the hand pile and is never
  automatic again. Undo and the release are one compare-and-swap on `released_at`.
- **Audit** — `admin_audit_log` rows `payment_auto_match_held · _undone ·
  _released · _release_refused · _not_released`.
- **Notice** — on-screen toast + the "N matched by themselves" list only; no email.
- `an-ai-may-not-approve-money.test.ts` amended citing the ruling: both new files
  join `MONEY_GATES`.
- **Migration** `20271351549033_received_auto_match_hold` — two columns
  (`released_at`, `auto_undone_at`) + a CHECK + an index. Needs the owner's OK.

SPEC IMPACT: None new — implements the 2026-11-17 DECISION_LOG rows above. Open
owner questions are listed in the PR's STATUS comment.
