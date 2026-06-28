## 2026-06-28 · feat(budget): one-click "suggest a deposit + balance split" for off-platform vendors

Closes the gap noted in PR #2348: a contracted off-platform vendor with a
lump-sum total but no dated milestones contributed to the budget totals but never
appeared in the live "next payments" list (no due dates). Now the couple can seed
a sensible split in one tap — owner ask 2026-06-28.

- New server action `addSuggestedMilestones(eventId, vendorId)` seeds two
  **editable, deletable** line items: **Deposit (50%, due today)** + **Balance
  (50%, due ~14 days before the event)**. The balance is left undated when the
  event has no date (or the −14d date is already past). The balance absorbs the
  rounding remainder so the two always sum to the exact total (no centavo drift).
- **Not silent auto-creation** (a deliberate product choice — we don't fabricate
  financial rows behind the couple's back). It fires only from an explicit
  "Suggest a deposit + balance split" button, shown only when the vendor is
  off-platform/manual-priced, has a total > 0, and has **zero** existing line
  items. The action re-checks every guard server-side (incl. rejecting
  marketplace vendors, who set their own payment plan, to avoid double-counting).
- New client `SuggestMilestonesButton` (toasts the result); wired into the
  per-vendor `VendorItemizationCard` empty state. On success the page revalidates,
  the two milestones render, and the button disappears.

SPEC IMPACT: Iteration 0007 (budget_expenses) — adds a suggested deposit/balance
seeder to the per-vendor card. Logged in corpus `DECISION_LOG.md`.
