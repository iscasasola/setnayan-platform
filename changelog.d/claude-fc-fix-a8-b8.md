## 2026-11-25 · fix(admin): money desks, disputes and deletions say what happened (final check area 8, batch 8)

- Payments: a refund, reject, ask-again or confirm-total refusal (the two-admin refund request, "already
  refunded", Maya's own refusal) lands on the opened payment as a notice, never the crash page. "Read it" returns
  to the same payment and says when the payment could not be read. A failed same-day read shows "Event today · —",
  and a failed reader read says so instead of "Nobody has read this picture yet".
- Receiving accounts: no typed peso figures in the QR note or the field placeholders.
- Receipts: the month is the Manila month (BIR reconciliation), the picker offers every month since the first
  receipt, and the tiles say "newest 200" when the list is full. Money › Everything does the same on its numbers
  and its phone list.
- Accounts: the Events and Demo tabs read past the 1,000-row reply ceiling; the Delete and Blacklist confirms
  describe the erasure that really runs (one shared sentence, `lib/erasure/erasure-words.ts`); the Demo tab makes
  one true statement and names the marketplace on Discover.
- Team: Add, Save and Take all away say what happened, and a second press never opens a second request.
- Disputes: settle, resolve and fee-dispute outcomes are said on the page; refusals on Disputes, Completions and
  Fraud are said, not thrown. Force-majeure flags say "couldn't read" for a booking, couple or handler they
  could not read. Verification documents use the shared admin gate. Verify presses land back on their tab or shop.
- Guards: `apps/web/app/admin/money-and-decisions-say-what-happened.test.ts`, `lib/receipt-months.test.ts`,
  `lib/read-every-page.test.ts`, `lib/admin/verify-back.test.ts`.
- Findings: A8·A-2 A8·A-5 A8·A-7 A8·A-8 A8·A-18 A8·A-20 A8·A-22 A8·D-11 A8·D-12 A8·D-13 A8·D-14 A8·E-1 A8·E-5
  A8·E-8 A8·E-9 A8·E-13.

SPEC IMPACT: None. No amount, fee, plan content or sign-in rule changes; only how outcomes and failed reads show.
