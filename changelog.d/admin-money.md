## 2026-11-14 · feat(admin): Money inner screens onto the approved drawing — Payments desk, the payment opened, Refunds, Everything, Launch offer (slice A2)

Owner, 14 Nov: *"Yes, queue the builds"* — the approved drawing is `Setnayan-specs/prototypes/admin_pub/money.html`
(inventory `prototypes/admin_five_tabs_2026-11-13/inventory/03-money.md`). Every fact and action each page had is
kept; only where it sits changed. No address moved, so nothing needed a redirect: every old URL still opens the same
page, and `lib/admin/admin-tabs.ts` already gives each one its tab.

- **Money › To confirm (`/admin/payments`)** — one row per payment: who · amount, what · account · last four of
  the reference · age (or "Event today"), then the money verdict ("Clean match · ref + amount", "₱100 short of the
  amount to send", a duplicate reference). ONE action: a clean match confirms in the row (the same one-click approve);
  anything else opens the payment. Rows sit in sections — To confirm · Resubmit requested · Matched · Rejected.
  Above them: the three shipped filters as one segmented control (To confirm · All payments · Needs a quote), the
  search, `Platform ▾` (the house picker; was a chip strip), and three numbers between hairlines — received this
  week, to confirm (an exact count, not the newest-100), event today — each "—" on a refused read, never 0.
  "Match a notification" folds away; the matcher's matches now open the payment.
- **A payment, opened (`/admin/payments?open=<id>`)** — every part of the old card: the screenshot, what the AI
  read (advisory, still gates nothing), the facts, buyer · event · order status · the code badge, what the bill
  covers, the resubmit notice or the review note, then **Decide** (Confirm with the note, "Also mark order as paid"
  and the duplicate acknowledgement · Ask to resubmit · Reject) or, on a paid order, **If they can't use it**
  (Convert to Papic credits · Move to their next event · Record a refund).
- **Needs a quote** — one row per order; Confirm total folds open under it with the same two fields.
- **Record a payment received** — same form, now a section; "Paid into" is the house dropdown, not a native select.
- **Money › Refunds (`/admin/payments/supplier-refunds`)** — the drawing's three parts: our own recorded refunds
  (`order_refunds`), large refunds waiting on an approval (`admin_approval_requests · approve_large_refund`), and the
  supplier refunds (table and totals kept). Each list says "Couldn't read" on a refusal, never "none".
- **Money › Everything (`/admin/money`)** — the card grid under the ledger is gone; every card already has a home in
  View ▾, the Money ⚙, or Catalogue (`admin-routes-all-have-a-tab.test.ts` holds that).
- **Money ⚙ › Launch offer** — status as hairline rows, sections with the ⓘ; the two forms unchanged.
- The desk's drawing moved into `app/admin/payments/_components/desk.tsx` (the page keeps every read) so the new
  fixture lab `/dev/admin-money-lab` can draw it; the guards that read the page now read both files.
- `app/_components/template-rows.tsx` is byte-identical to the one in #7632 (the template row kit), so whichever
  merges first, the other merges clean.

Server actions: unchanged (no new one). Migrations: none.

SPEC IMPACT: None — builds the approved drawing; no decision changed.
