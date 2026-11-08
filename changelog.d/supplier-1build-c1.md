## 2026-11-08 · feat(supplier): THE ONE BUILD lane C1 — Today (v113), the Payment and Files pages of a picked client

**Today (`/vendor-dashboard`, A2 part A, A1–A14)** — owner *"Approved suuplier dashboard"*, contract v113:
- The cover greets the SHOP by the Manila clock ("Good morning, <Shop>") with the date and "N tasks today"
  (`lib/supplier-today-greeting.ts`); Today's ⚙ (unchanged contents) rides the cover, one mount.
- Next events: the next event day's bookings as photo cards in the one shared carousel ("2 tomorrow · swipe", "1 of 2"),
  call time + the day's first chapter, Hub ready / not set up, Balance paid / ₱X due, the day's next moment and
  check-ins on the day; a tap opens that client's Hub page (`lib/supplier-today-next-events.ts`, one batched read in
  `readNextEventFacts`).
- Five stats, each a link (Views · Inquiries · Booked "this month" · Portfolio · Money "to come in"); an unread figure
  says "couldn't load". The counts row that filtered in place is retired (`today-counts.tsx` deleted).
- Needs you today: one row per thing waiting, in the app's own words, in `pickSupplierNext`'s order — and every row
  JUMPS to its page (owner v112 *"Jump"*). Search + Show ▾ narrow the rows in place. The business-permit row (A9) reads
  the badge's own deadline off the one shop-row read.
- The date-change and delete-request answers moved to the client's Details: `ClientDayAnswers` (shipped bodies, actions
  and Undo holder) for L2 to mount; `ANSWERED_ONLY_ON_TODAY` is now [].
- Tour `vendor_today_v3`; the app-wide supplier tour's Today stops re-pointed.
- #7369 folded (paper rows + shop QR step + setup tour), its lint reds fixed and its tour's bar sentence corrected.

**Payment page (`clients/[eventId]/_pages/payment.tsx`, B2 §2.3)** — Agreed · Paid · To collect through the couple's
own budget figures (`BudgetFigures`, split out of `BudgetSummary` — the couple's Budget is unchanged), the plan rows,
the couple's logged payments answered in place, the asks, the reservation line (`lib/client-payment-view.ts`).

**Files page (`clients/[eventId]/_pages/files.tsx`, B2 §2.4)** — Finder-style over the three sources: All files
newest-first at the root, three folders with counts, View & sort ▾, the chat's own limits (`lib/shared-files-view.ts`).

SPEC IMPACT: corpus DECISION_LOG rows owed by the controller at integration (direct-edit authorization) — (c) Today rows
jump + Today greets with the shop name + the counts row retired (supersedes 2026-10-28 "counts FILTER in place" on
Today); (d) the date-change / delete-request answers live on the client's Details. No schema change.
