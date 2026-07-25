## 2026-07-10 · feat(launcher): "needs a decision now" line on the hub cards

Owner 2026-07-10: "shop will also show how many tasks need decision now — this
applies to all", and the reporting shape should be understandable, not a bare
count badge. Chosen shape (owner pick): a NAMED champagne-gold action line that
says WHAT is waiting, e.g. "2 quotes to approve" / "3 new inquiries". Cards with
nothing pending show no line — calm by default.

Phase 1 (this PR) — three signals, all cheap, batched, no schema change. There
is deliberately no reusable notifications aggregation to lean on (the top-bar
bell is a flat per-user unread count with no event scoping / no "actionable"
flag), so each signal is its own query.

- **Event cards** (`app/dashboard/(launcher)/page.tsx` + new `lib/event-decisions.ts`):
  per active event, the top pending decision across
  - pay — `orders` in `awaiting_payment`,
  - approve — `vendor_proposals` in `sent`/`viewed`,
  - overdue — checklist items past their derived due date (computed from the
    checklist the card already loads for the progress ring — no extra query).
  Priority: pay → approve → overdue; "· N more" when other kinds also wait. Pay
  + approve are two batched queries across all events; a pure
  `summarizeEventDecisions()` folds in overdue.
- **Vendor shop cards**: pending client inquiries per shop (`chat_threads.
  inquiry_status = 'pending'`), one batched query across the user's shops →
  "N new inquiries".
- **Admin HQ card**: total open items across every work queue via the existing
  `getAdminQueueDigest()` + `deriveQueueUrgency().totalOpen` → "N awaiting
  review". Gated to admins, so the per-queue fan-out never runs for a couple.

Every query graceful-degrades (a failure drops the line, never the page). The
shared `<AttentionPill>` renders on event + shop + admin cards.

Phase 2 (follow-up PR, owner-approved sequencing): the fourth signal — unread
messages *per event* — needs a new grouped read-only RPC (the shipped counter
flattens to one number across the whole account), so it ships separately.

SPEC IMPACT: None (UI on an existing shipped surface, reading existing tables;
no schema, SKU, or locked decision changed).
