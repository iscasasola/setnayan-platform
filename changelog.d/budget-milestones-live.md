## 2026-06-28 · feat(budget): live payment-progress summary — total paid / balance / total to pay, % complete, next coming payments

The couple's Budget page (iteration 0007) now leads its Payments section with a
single live card that answers "how are we tracking on payments?" at a glance and
updates in real time — owner ask 2026-06-28.

**What the card shows**

- **Three headline totals:** Total to pay (sum of every vendor's itemized total),
  Paid so far, and Balance (still owed).
- **Percent complete:** a progress bar + whole-number % of the budget paid.
- **Next coming payments:** the soonest unpaid milestones (host-entered line items
  with a due date), earliest first, each with vendor · label, the due date, a
  relative "in N days / due today / N days overdue" hint, and the still-owed
  amount. Overdue milestones sort to the top with a warning accent. Per-line
  "still owed" is computed the same way `renderBudgetIcs` does it (payments matched
  by `line_item_id`), so the card, the `.ics` export, and the per-vendor cards all
  agree.

**Real time**

- New client component `BudgetLiveSummaryCard` subscribes to Supabase Realtime on
  `event_vendor_payments` + `event_vendor_line_items` (filtered to the event). Any
  insert/update/delete triggers a server refetch (`getBudgetLiveSummary`), so
  logging a payment in one tab updates the card in every open tab within ~500ms —
  no refresh. First paint uses a server-computed `initial` prop (correct before the
  channel connects); reconnects backfill missed events.
- Migration `20270314132689_enable_realtime_budget.sql` adds the two ledger tables
  to the `supabase_realtime` publication (idempotent, guarded; RLS already scopes
  delivery to the couple's own event). **Applied to prod** (`setnayan-prod`) with a
  matching `schema_migrations` ledger row, so a later `supabase db push` is a clean
  no-op.

**Shared logic**

- New pure helper `buildBudgetLiveSummary(snapshot)` in `lib/budget.ts` collapses a
  `BudgetSnapshot` into the serializable summary. Runs identically on the server
  render and inside the realtime refetch action — one definition, no drift.
- Replaces the old static four-tile `StatsStrip` ("Due in 30 days" aggregate) with
  the richer live card; the dated next-payments list supersedes the aggregate.

SPEC IMPACT: Iteration 0007 (budget_expenses) gains a live payment-progress summary
surface. Logged at the bottom of the corpus `DECISION_LOG.md`; the iteration spec is
reference/history per the 2026-06-07 ground-truth flip (code is canonical).
