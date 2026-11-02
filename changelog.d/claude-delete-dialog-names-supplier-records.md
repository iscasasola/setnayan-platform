## 2026-09-18 · fix(delete): the remove dialog says what happens to suppliers' records (SUP-106)

The "Remove for good" screen listed only what the couple loses. It now also
says, beside the button, what the suppliers they worked with keep and lose —
describing TODAY's behaviour, which the owner has not ruled on changing (DATA-01):

- **Kept:** payments the supplier confirmed (amount and date only — the couple's
  bank details, notes and screenshots are scrubbed), and the proposals and
  contracts they sent.
- **Removed:** the conversations, the supplier's payment schedule, and their
  deliveries for this celebration.

Every clause was measured against production (`pg_constraint` ON DELETE rules on
the events FK, 2026-09-18) and is pinned by a new
`tests/db/the-delete-dialog-tells-the-truth-about-suppliers.db.test.ts`, which
reads the rules out of the replayed schema. If the behaviour changes, the test
names the sentence to rewrite. The receipts clause stays proved by
`the-money-outlives-the-event.db.test.ts`.

SPEC IMPACT: None — copy describing shipped behaviour; DATA-01 (whether suppliers
should keep more) remains an open owner question.
