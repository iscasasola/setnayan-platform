## 2026-11-20 · feat(chat): Unichat part H2 — terms at Accept, receipt, crew for the day, handover and review

The deal half of plan row H (`build-sessions/UNICHAT-BUILD-PLAN-2026-11-20.md`; drawing
`build-sessions/UNICHAT-LIVE-2026-11-19.html`). Stacked on #8053 (part C). Rule 0 held for every piece: each card is the
chat face of a record that already ships — **no new table, no new column, no new policy, no new server action.**

- **Terms at Accept.** A supplier already writes their terms on the service card (the first payment's reservation
  terms: cancellation, non-refundable, refund window, no-show), and a quote has always had a terms field
  (`vendor_proposals.rendered_terms`, drawn under "Terms" on the full quote page) — but a quote made in the chat or
  the maker stored `''` there. Now `sendCustomProposalCore` (`lib/proposal-send.ts`) **freezes the cards' terms onto
  the quote when it is sent** (`quoteTermsFromCards`, `lib/deal-end.ts`: said once when the cards agree, under each
  card's name when they differ). A refused read of the terms stops the send — it is never sent as "no terms".
  - The chat's quote card shows them under its lines, above Accept — the drawing's `.terms` line, ⓘ + "You agree to
    <shop>'s terms" → a tap opens the exact words (`cards/quote-terms-line.tsx`, mounted in `AskChangeDoor`). After
    Accept: "You agreed to …".
  - The full quote page says the same sentence beside **Accept quote**.
  - The record: the accept already stamps who and when (`respond_vendor_proposal` → `resolved_by_user_id`,
    `resolved_at`) on the row that carries the frozen terms. Nothing else is stored.
  - A quote whose cards state no terms shows no terms line at all.
- **Receipt card.** The ledger's own line ("Payment confirmed · ₱…", written by the payment trigger since
  20271329937802) is drawn on the hosts' side as a receipt (`cards/receipt-card.tsx`), the drawing's face: the amount as
  the hero with "Receipt" beside it, then how it was paid · the day · its reference; under it one row — what is left
  after this payment (a balance stays on the card, never behind an ⓘ). Every figure is read from the payment row (`event_vendor_payments`) and the accepted
  quote's total — the line's words only find the row. What is left is the total less what was confirmed **up to that
  payment**, so an older receipt does not change later. No accepted quote → "What is left shows once a quote is
  accepted", never a number. A refused read says it could not load; a payment that cannot be found says so. The
  supplier's side keeps its short line (the payment ledger is the hosts' table).
- **Crew for the day.** The crew is the supplier's crews as they already stand on the event's schedule
  (`event_schedule_tasks`: crew · what · call time — written through the shipped "+ My moment → Who on our side").
  The hosts see the drawing's ONE quiet line — "<shop>'s crew is set · 3 · arrive 12:00 PM"
  (`cards/crew-day-card.tsx`) — whose press opens each person, what they do, when they arrive (their own call time,
  else their moment's start; "Time not set" when neither). It reads the schedule live, with the schedule's own column
  list (`TASK_COLUMNS`). No crew, a refused read: a card that says so.
- **Handover, then the review.** A delivery posted through the shipped `vendorPostHandover` lands in the chat as a
  card (`cards/handover-card.tsx`; the drawing's "Handover" + what was delivered): **Open** beside the title (the house ActionButton through `KindCard`'s new `action` slot — only when the delivery
  has a real http/https link), and the hosts' **I received it** — the shipped
  single-winner `acknowledge_handover`, the same press as the workspace's Handover inbox. Confirmed, it folds to one
  ✓ line. Then the review ask: "How was <shop>?" with the drawing's ⓘ (C's `KindCard` `info` slot) holding one line on how
  reviews work — "Public on their shop page and Setnayan. They can reply once." (the supplier's copy says "your" /
  "You") — and → **Write review** opens the shipped review page (which holds every
  rule about who may review); once posted, both sides see the stars and the line.
- **Migration `20271354150744_the_deals_end_is_said_in_the_chat`** — lines only, written the way every payment and
  booking line already is (`chat_record_post_line`, never raises): "Handover · <kind>[ · label]" · "Handover received
  · <kind>" · once per chat "Review asked · how did it go?" (skipped when a review exists) · once per chat "Crew
  named for the day". Trigger functions only, EXECUTE revoked from everybody. Applied by the pipeline only.
- Chips: a receipt counts under Money, crew under Dates, a handover under Files, the review ask under Decisions
  (`lib/chat-kinds.ts`).
- Lab: `/dev/chat-cards-c-lab?m=dealend` (`&e=1` for each card's "nothing found" face; `&f=1` for every hosts'
  card unseeded, so each read is refused and says "Couldn't load"), both sides.
- §4 proof: `build-sessions/shots-unichat-h2/` — drawing-vs-build pairs per card at 375 light and dark and desktop,
  from `drawing.mjs` (drives the approved three-phone drawing to each scene) and `build.mjs` (the lab + the pairs).
- 🔒 `apps/web/lib/deal-end.test.ts` (7) · `apps/web/tests/db/the-deals-end-is-said-in-the-chat.db.test.ts` (7).

NOT built here:
- **Accept → "Book it", capped by what is free.** TODAY the hosts' quote card in the chat keeps its shipped
  door to the full quote page (`/proposals/<id>`), whose **Accept quote** accepts the whole quote
  (`respondToProposal` → `respond_vendor_proposal`); there is no "Book it" step and no count against what is free. Availability step 4 (#8012) builds exactly this on the booking
  path — the couple picks how many, `booked_quantity`, "told honestly if not enough are free", and the
  all-or-nothing count in the database. It was still open while this was built, and a second count here would have
  been a competing answer to the same question. The chat step is the next small build on top of it (`bookItCap` in
  `lib/chat-deal.ts` is ready).
- **The receipt's PDF press and S89R number** (the drawing's "PDF"): later build — a supplier-payment receipt
  document. Until it exists the card has no PDF press and no receipt number (no dead buttons; held by
  `lib/deal-end.test.ts`).
- **The drawn crew picker** (pick from the shop's team + one call time under ⋯ → Crew): ⋯ is part G (#8048) and the
  self-set backstage "Crew call" is part F (#8046). The card here reads whatever those write.
- **A Terms row in the quote editor**: terms are the service card's; the editor does not retype them.

SPEC IMPACT: `DECISION_LOG.md` 20 Nov row, specs commit 1675080f ("decision: Unichat H2 — terms, Book it, receipt (no PDF until a
document exists), crew, handover")
(terms are the service card's reservation terms frozen on the quote at send; the receipt, crew, handover and review
cards read shipped records; Book it waits for Availability step 4, #8012).

**The terms line wears the house ⓘ (2026-11-21).** Not a lucide `<Info>`: InfoTip's drawn circle, class for class, with a SITES entry in `there-is-one-info-dot` (the whole `<summary>` line stays the press).

## 2026-11-22 · chore(chat): one PR for the deal's end, the schedule from the chat and the receipt document

Unichat parts H2 (#8080), F (#8046) and the supplier-payment receipt document (#8107) now ship as ONE pull request
(#8080); the other two are closed and point here. Merge commits only.

- The time-change ask card (`schedule-time-ask-card.tsx`, part F) now wears the one card look (`KindCard`, the meeting
  kind) like every other card in the stream: an open ask is the whole card with "Your turn" on the copy that has the
  buttons; an answered one folds to its settled line (accepted ticked, declined or taken back struck) and a press opens
  it. Held by `the-card-kinds-are-readable` test 3, which is what caught it.
- The part F shot script set dark mode before the page hydrated, so its "dark" shots came out light. It now sets it
  after, and stops if it did not hold. Both shot sets were re-shot on the combined branch.
- A Time-TBA moment (its `start_at` is a placeholder midnight) no longer reads as 12:00 AM in three new reads: the
  crew card's arrival (`deal-end-calls.ts`), and the "from" time of a time-change ask sent by a supplier
  (`clients/[eventId]/actions.ts`) or by a host (`schedule-ask.server.ts`). Each now reads `time_tba`; a TBA moment
  gives no arrival and no "from" time. Held by `a-tba-chapter-is-never-midnight`.
- The crew card's schedule read is classed in `the-guests-schedule-has-one-fence` (hosts and the booked supplier, never
  a guest); the receipt document's back is on the back map (`page-home.ts`, worked out by the page: the chat it was
  opened from); the F lab's made-up ₱31,000 label is declared in `public-price-literals.ts`; the supplier's schedule
  list heads the event day's group "The Day" (owner d25), not "On the day".

SPEC IMPACT: None
