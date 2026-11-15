## 2026-11-14 · feat(admin): Work request cards — every queue item reads like a request, not a database row

Owner, 14 Nov: *"approved admin request cards"* → *"Yes, queue the builds"* (drawing
`prototypes/admin_request_cards_2026-11-14_fable.html`, findings `prototypes/admin_work_cards_findings_2026-11-14.md`).
Live fault fixed: Work · All › Profile corrections showed `Change logo_url`, two `r2://` paths, an `apply` select and a
reason select already reading "Too close to another shop's name" on a LOGO request.

- **One card** (`app/admin/queues/_components/request-card-view.tsx`) for every item a Work row opens: plain title (who
  wants what) · queue chip · age · red edge past the promise · the real thing (old/new logo as pictures, old/new text,
  paper thumbnails, the receipt facts, the held review) · their own words · who asked + when (Manila) · **Open shop ↗**
  (public page, new tab) · **Open record** · the decision.
- **Decide here (10 queues):** corrections Approve · Decline · payments Confirm · Ask for a clearer photo · verify
  Verify shop · Needs a fix · subscriptions Confirm · Decline · payment options Approve · Hold · reviews Publish · Keep it
  held · approvals I agree · I don't · help Reply + Send and keep open · Close · chat flags Looked at it · Dismiss.
  **One detail:** payouts (how it was paid + reference). **Open the case / Done elsewhere:** the judgement and
  settled-elsewhere queues keep their 2026-08-05 rule, now drawn as the same card's footer.
- **Declines are picked from a list that fits, never prefilled** (`card-decide.tsx`): radios start empty, the sheet's
  button stays off until one is picked. New lists in `SUPPLIER_WORK_REASONS`: logo · place · contact · other · proof ·
  plan · publish · held · approval. `declineCorrectionRequest` checks the reason against the request's own field.
- **No new server action**: the new second buttons are intent branches on the existing Work actions
  (`requestPaymentResubmit`, `rejectRequest`, `rejectAppeal`, subscriptions' reject now needs a listed reason).
- A card press returns to Work with the row still open; every outcome and refusal is said (`asked`, `kept`,
  `declined-request` added to the notices).
- Guard `app/admin/work/request-cards-say-it-plainly.test.ts` (5 tests, 5 sabotages measured red). Shots of the real
  card on sample rows at 390 and 1280: `docs/review/admin-request-cards/` (typed fields since moved onto `TypedRow`).

SPEC IMPACT: None to locked decisions. Two wordings differ from the drawing and need the owner's eye: the logo reason
"has a phone number, link or **amount** on it" (the drawing said "price"; a shipped guard forbids the word on any
reason), and the new reason lists for payment proof, plan payments, review publish/keep and approvals, which the
drawing did not word.
