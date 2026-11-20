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
  - The chat's quote card shows them under its lines, above Accept: "Accepting means you agree to <shop>'s terms" →
    opens the exact words (`cards/quote-terms-line.tsx`, mounted in `AskChangeDoor`). After Accept: "You agreed to …".
  - The full quote page says the same sentence beside **Accept quote**.
  - The record: the accept already stamps who and when (`respond_vendor_proposal` → `resolved_by_user_id`,
    `resolved_at`) on the row that carries the frozen terms. Nothing else is stored.
  - A quote whose cards state no terms shows no terms line at all.
- **Receipt card.** The ledger's own line ("Payment confirmed · ₱…", written by the payment trigger since
  20271329937802) is drawn on the hosts' side as a receipt (`cards/receipt-card.tsx`): the amount, what for, paid on,
  paid by, and what is left. Every figure is read from the payment row (`event_vendor_payments`) and the accepted
  quote's total — the line's words only find the row. What is left is the total less what was confirmed **up to that
  payment**, so an older receipt does not change later. No accepted quote → "What is left shows once a quote is
  accepted", never a number. A refused read says it could not load; a payment that cannot be found says so. The
  supplier's side keeps its short line (the payment ledger is the hosts' table).
- **Crew for the day.** The crew is the supplier's crews as they already stand on the event's schedule
  (`event_schedule_tasks`: crew · what · call time — written through the shipped "+ My moment → Who on our side").
  The hosts see a card (`cards/crew-day-card.tsx`): each person, what they do, when they arrive (their own call
  time, else their moment's start; "Time not set" when neither). It reads the schedule live.
- **Handover, then the review.** A delivery posted through the shipped `vendorPostHandover` lands in the chat as a
  card (`cards/handover-card.tsx`): Open (http/https links only), and the hosts' **I received it** — the shipped
  single-winner `acknowledge_handover`, the same press as the workspace's Handover inbox. Confirmed, it folds to one
  ✓ line. Then the review ask: "How was <shop>?" → **Write review** opens the shipped review page (which holds every
  rule about who may review); once posted, both sides see the stars and the line.
- **Migration `20271354150744_the_deals_end_is_said_in_the_chat`** — lines only, written the way every payment and
  booking line already is (`chat_record_post_line`, never raises): "Handover · <kind>[ · label]" · "Handover received
  · <kind>" · once per chat "Review asked · how did it go?" (skipped when a review exists) · once per chat "Crew
  named for the day". Trigger functions only, EXECUTE revoked from everybody. Applied by the pipeline only.
- Chips: a receipt counts under Money, crew under Dates, a handover under Files, the review ask under Decisions
  (`lib/chat-kinds.ts`).
- Lab: `/dev/chat-cards-c-lab?m=dealend` (`&e=1` for each card's "nothing found" face), both sides.
- 🔒 `apps/web/lib/deal-end.test.ts` (7) · `apps/web/tests/db/the-deals-end-is-said-in-the-chat.db.test.ts` (7).

NOT built here:
- **Accept → "Book it", capped by what is free.** Open PR #8012 (Availability step 4) is building exactly this on the
  booking path — the couple picks how many, `booked_quantity`, "told honestly if not enough are free", and the
  all-or-nothing count in the database. A second count here would be a competing answer to the same question; the
  chat step should be built on #8012 once it lands (`bookItCap` in `lib/chat-deal.ts` is ready for it).
- **The receipt's PDF** (the drawing's "PDF" press): no receipt document exists for a supplier payment — Setnayan
  does not hold that money, the hosts' proof is the record.
- **The drawn crew picker** (pick from the shop's team + one call time under ⋯ → Crew): ⋯ is part G (#8048) and the
  self-set backstage "Crew call" is part F (#8046). The card here reads whatever those write.
- **A Terms row in the quote editor**: terms are the service card's; the editor does not retype them.

SPEC IMPACT: `DECISION_LOG.md` — a 20 Nov row is needed: "Unichat H2 as built — terms are the service card's
reservation terms frozen on the quote at send; the receipt, crew, handover and review cards read shipped records;
Book it waits for Availability step 4 (#8012)". Not edited from this builder's worktree — for the controller to
apply with the rest of the Unichat rulings.
