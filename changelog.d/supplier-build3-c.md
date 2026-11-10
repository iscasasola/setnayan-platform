## 2026-11-09 · feat(chat): the step-by-step (+) cards — Change quote · Payment · Log a payment · Form · Photos & files · Decision · Ask for a change · Guest count · Booking ask (Supplier Build 3 · lane C)

Every card sits on lane B's one-step frame (`chat-step-card.tsx`), is lazy (`cards/lazy-cards.tsx`, riding the conversation's own on-demand `thread-parts` chunk — no new chunk
id in the shared bundle's webpack runtime),
and sends through the SHIPPED writer — no second write path.

- **Change quote** (supplier): Add · Change · Remove → line → price → Review (tap a line to change it, swipe left to
  remove it, Undo) → Valid until (required) → `sendCustomProposalFromChat`, a new version the hosts accept again.
  The paid quotation is the floor ("Can't go below ₱X — what they paid for. Add something to swap.").
- **Pay in full, in the database too**: migration `20271332041210` adds the `vendor_proposals_money_rules` trigger —
  a sent quote may not go under the paid quotation (`QUOTE_BELOW_PAID_FLOOR`) and its plan must sum to the total
  (`PLAN_DOES_NOT_PAY_IN_FULL`); `change_lines_keep_the_paid_floor` holds the same floor for change-order lines.
  `sendCustomProposalCore` now re-resolves the plan against the SERVER's total and refuses Σ ≠ quote
  (`plan_not_in_full`). One ledger (`planLedger` in `lib/chat-cards.ts`) draws the plan on the chat cards.
- **Ask for a change** (hosts / coordinator): `booking_change_asks` + `ask_for_a_change()` / `answer_change_ask()`
  (DEFINER; refused for the shop's own team and while the item is locked); the supplier answers Revise | Decline
  on the card under the ask's line. `paid_quote_floor_centavos()` reads the floor only for the event's people / shop.
- **Payment** (supplier): Which payment? (the ledger's unpaid rows) → How much? → By when? → note →
  `vendorAskForPayment` with `inline=1` (its core, `askForPaymentCore`, is not exported; the client page's form gets
  the same redirects as before, the chat gets the outcome back and stays put).
- **Log a payment** (host): amount → how → reference → date → receipt (+ **Agree, REQUIRED** to a coordinator /
  planner, read from the booking's own category) → the shipped `logPayment`.
- **Form**: supplier picks a saved form and sends it (`formsAction` send); the host answers it one question at a
  time under the supplier's form line (`saveSupplierAnswers`), Stop for now / Continue.
- **Photos & files / File**: From where? → From your phone opens the shipped chat attach. Portfolio album + hearts
  → Inspiration drawn shut with its reason (not built — needs an album record).
- **Decision**: name a topic → Open, through lane B's `openDecision` (`chat_decision_open()`: the topic row + its line,
  shown as a pin). Closing / reopening is the pin's own `DecisionToggle`.
- **Guest count changed** (lane B's line): per-guest lines only, Apply ₱X | Keep price (one row); flat-only quotes
  are told; a locked quote is never recounted.
- **Booking ask** lines drawn as their card (exact database words only).
- **No new server action** (`scripts/lint-server-action-budget.mjs`, ceiling unchanged): the cards' reads and new
  writes are BROWSER calls with the reader's own session (`cards/card-calls.ts`, lane B's `blocker-show.ts`
  pattern) — reads are RLS, the new writes are the DEFINER RPCs above; the shipped writers stay the shipped actions.
- Guards: `app/_components/chat/cards/lane-c-cards.test.ts`, `lib/chat-cards.test.ts`,
  `tests/db/a-host-asks-and-only-the-supplier-writes-the-price.db.test.ts`; erasure + Ugat baseline lines for
  `booking_change_asks`. Lab: `/dev/chat-cards-c-lab` (dev only).

SPEC IMPACT: None new — implements the owner rulings already in `DECISION_LOG.md` 2026-11-08/09 (🧾 floor, 💳 pay in
full, 🤝 Agree required) and `plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md`. Rulings NOT built here
are listed in the PR body (album + hearts, decision filing, post-booking re-quote under S5).
