## 2026-11-04 · feat(quotes): every version of a quote, and what changed — both sides + Admin › Disputes (slice 1)

Owner, 4 Nov 2026: *"when we send a new quotation, it replaces the old quotation? and do we see the changes made in each quotation? for both sides?"* → approved prototype (`count-and-quotes.html`, screens "Chat · an updated quote" and "Chat · every version"), "Yes, build both". DECISION_LOG "2026-11-04 WHO A SUPPLIER COUNTS · QUOTE "WHAT CHANGED"…". Extends the 2026-09-18 ruling (an update supersedes and must be accepted again).

- **Version identity, no new column** (`lib/quote-versions.ts`): a quote's version is its place among the (event, supplier) pair's sent `vendor_proposals` rows, by send time; drafts are not versions; its predecessor is the row before it. The rows already state the order — a `supersedes_proposal_id` column would be a second source of truth for it.
- **`quoteChanges(prev, next)`** — the one diff: added / removed / re-priced lines (matched by service/card id when a line has one, else by name, repeats by occurrence), the payment plan old → new (one line read from the frozen `payment_schedule`), Total old → new.
- **The chat quote card** (`chat-message-stream.tsx`, both sides): "📄 Quote · version N"; badge "Updated" (couple) / "Waiting for them" (supplier) on a live pending version 2+; the plan line; "What changed since version N-1" (`quote-what-changed.tsx`); the couple's "Accept the update" posts the existing `respondToProposal` (new optional `return_to`, thread paths only, so it answers in the conversation); the supplier's revise button reads "Update again"; "See every version (N)" opens the sheet (`quote-versions-sheet.tsx`). Superseded cards keep "Replaced by a newer quote" and the dimmed look. Unknown history (read refused) → the card says nothing about versions, exactly as before.
- **Admin › Disputes**: per supplier, "Quote versions (N)" — each event's versions newest first with exact Manila timestamps, lines, plan and the same What changed.
- Guards: `lib/quote-versions.test.ts` (each case seen red under a deliberate break); `a-revised-quote-must-be-accepted-again.test.ts` now holds that the revise label comes from the rule.

NOT in this PR (slice 2): editing after booking with the paid part locked and the rest re-split — booking and payment logic untouched.

SPEC IMPACT: None — builds the approved 2026-11-04 prototype; the ruling is already in DECISION_LOG.
