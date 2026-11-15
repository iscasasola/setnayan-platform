## 2026-11-13 · feat(admin): "Approve all N green" on Work › Payments + every silent queue gets a count

Owner-approved admin drawing (`Setnayan-specs/prototypes/admin_pub/`, DECISION_LOG 2026-11-13 "ADMIN DRAWING APPROVED — BUILD IT"); the solo-operator audit's Top-10 #4 and fact 4 (`prototypes/admin_five_tabs_2026-11-13/SOLO-OPERATOR-AUDIT.md`). Builds on the five-tab shell (#7586); stays out of slice 2/3 scope.

**Payments — "Approve all N green" is the one action on the Work › Payments row.**
- Green = the rule the payments desk already uses for its clean-match badge: `isDecisivePaymentMatch` AND no reference collision with money already counted (`classifyDuplicate`). No new rule, no new AI (`lib/admin/green-payments.ts`).
- The press opens the house confirm (`ConfirmForm`) listing every payment it approves; amber rows are not in it. On the server every id is re-sorted with the same rule before anything is written, then approved through `approvePaymentCore` (the single money path; a duplicate can never clear in a batch). Any row no longer green is left and said; a failed re-check approves nothing.
- Each payment in the opened row shows the receipt read's own sentence, and amber rows show one "Why held:" line (no reference or screenshot · order code not in the reference · no total yet · this transfer alone does not cover what is owed · same reference already counted).
- The receipt read stays advisory: it is loaded only for display (`lib/admin/payment-verdicts.server.ts`), never by the sort the batch re-checks with. `an-ai-may-not-approve-money.test.ts` now lists the three new money-path files.
- No new exported server action (an intent branch on `approvePaymentFromWorkList`), so the route budget is unchanged. Two-admin / 24 h rules: none applies to confirming a payment, and none was changed.

**Silent queues — a badge on Work, a line in the digest.** Ten queues that filled with no badge now count in `QUEUE_DEFS` (`lib/admin/queue-counts.ts`), each mirroring its page's open rows: repost watch (both tables) · fraud queue (auto-suspended, needs your look) · editorial review (flagged) · pax changes (this week) · social queue (failed posts + take-downs owed) · Music Maker (paid songs to write) · supplier refunds (this week) · service requests (pending) · Problems (open issues) · email bounces (this week). They appear as Work rows, Overview tiles and View ▾ counts, and as named lines in the morning digest builder ("Also on your list: Fraud queue — 2 auto-suspended, need your look").
- A failed count is NULL everywhere: "Couldn't count" on Work, "couldn't count" in the digest — never 0. A sum of two tables with one refused is unknown, never the smaller number.
- No clocks invented: every new queue is `slaHours: null` until the owner sets a promise time. Pax changes and supplier refunds are trails to watch (`watchOnly`) — they show the week's number and stay out of "items need you".
- Fixed on the way: Work turned a no-clock queue back into a 48-hour promise (`meta?.slaHours ?? 48`); the Overview's standalone category-request count is now the shared `service-requests` count.
- **Not done, on purpose (owner calls):** the digest is NOT switched on, no evening run, no new email.

New guards: `lib/admin/silent-queues-have-a-count.test.ts` (every listed queue has a count source, a Work row and a digest line; each answers "unknown" against a database that refuses every read; sabotage-checked) and `lib/admin/green-payments.test.ts` (green ⇔ the desk's rule over a case grid; every amber says why; receipt read never an input; batch re-checks and keeps the confirm).

SPEC IMPACT: None — implements the approved drawing and audit items; no ruling changed. Open owner calls left open: switching the digest on, an evening run, per-lane overdue emails, and promise times (SLA) for the ten newly counted queues.
