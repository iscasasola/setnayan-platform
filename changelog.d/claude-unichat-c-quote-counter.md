## 2026-11-20 · feat(chat): Unichat part C — quote, counter and payment plan in the box

The chat's money editors take the approved Unichat shape (drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`, plan
row C of `UNICHAT-BUILD-PLAN-2026-11-20.md`). No migration, no new server action, no new write path: every Send is the
shipped writer (`sendCustomProposalFromChat`, `ask_for_a_change`).

- **The quote is a receipt** — `apps/web/app/_components/chat/cards/quote-receipt.tsx` + `apps/web/lib/quote-receipt.ts`.
  The quote maker's real parts on one card: lines (name · price each · how many · Free), Crew meal, Transport,
  Discount (with its reason), How they pay, and Subtotal → offer → Discount → Total at the foot. Priced through the
  maker's own resolvers (`crewChargeCentavos` / `crewCreditCentavos` / `transportChargeCentavos`, `quoteMoney`,
  `resolveSchedule`) and written in the maker's own stored words, so a quote made in the chat re-opens correctly in
  Full quotation. Nothing is invented: a new line opens empty, a crew charge opens with no crew and no rate.
  - **Change quote** (`quote-step-card.tsx`) is now that receipt in place of the five-step walk. A sent quote opened
    and sent untouched is the same quote: a per-guest line keeps its basis, an offer's line and its gifts and a stored
    crew-meal credit are kept verbatim, "Quoted after site check" stays unpriced. The paid floor, the locks, the
    change-order door and the required Valid until (it opens filled) are unchanged.
  - **Make a quote** (`make-quote-card.tsx`) keeps its one-price card; **Itemise** opens the receipt with a line per
    picked card. A typed offer under the cards' prices opens as a Discount (same parts, your price).
- **Availability tag per line** — a line wears its own service card's style (`vendor_services.availability_style`,
  read by `loadCardAvailability`). A card with no style wears no tag; an unread one wears none either.
- **The counter editor** (`negotiate-cards.tsx`) shows their ask · your quote · the gap, the range between the two
  sides with the halfway mark, and one-press amounts. The price opens on the **suggested counter: halfway between
  their ask and your quote, rounded to a whole peso, never below your lowest** — no lowest saved, just halfway.
  The lowest is read only on the supplier's side and is dropped for the hosts inside `counterContext` itself.
- **A custom payment plan must balance** — Propose a payment plan gains **Custom**: typed payments, each with its due,
  "Fill the rest" on the last one, a segment bar, and "Placed ₱X of ₱Y ✓". Send stays grey until the payments add up
  to the quote. A paid payment is drawn fixed and cannot be changed or removed.
- **The counter card's face is the drawing** (controller ruling 20 Nov) — `NegotiationCard` in `negotiate-cards.tsx`:
  ~~old price~~ → new price, ONE line under it ("Under your lowest" in the warn colour on the supplier's side, or the
  gap · until), an ⓘ, and **Decline · Counter · Accept** (Accept now says just "Accept", as drawn). Everything the card
  printed before — the amount, "instead of", the gap pill, their words, Good until, what Accept makes (the plan
  re-split, paid rows fixed, money owed back) and the lowest — moved into an **ⓘ sheet** built on the app's one
  `Sheet` (`app/_components/sheet.tsx`), with the state in words ("Waiting for the hosts", "The hosts answer this
  one", expired, the quote changed). A settled counter folds to the drawing's one line ("₱40,000 · accepted") whose
  press opens the same details. `KindCard` (`card-bits.tsx`) gained two optional props for it — `info` (the ⓘ slot)
  and `warn` (the kicker in the warn colour); every other card renders as before. The payment-plan card is unchanged.
  🔒 `app/_components/chat/cards/the-counter-face-is-the-drawing.test.ts`. Lab: `/dev/chat-cards-c-lab?m=counterface`
  (the drawing's own scene; `&v=host`, `&s=accepted|declined`). Shots: `build-sessions/shots-unichat-c/`.
- **Carries part A (#8044) at its SHIP head** — merged, keeping A's `mark="plan"` / `DEAL_MARK` (the counter's ⇄ is
  now A's by kind, so C's own chip went) beside C's ⓘ `info` / `warn`. **An unknown counter amount is never ₱0**:
  the face's title, the folded line, the ⓘ details and the line-halfway all read "₱ — amount not loaded" (A's words)
  — 🔒 `an-unknown-is-never-drawn-as-none.test.ts` test 1b. **A folded line never widens its column** — the
  `min-w-0` on the folded frame and its line is now held by 🔒 `a-folded-line-never-widens-its-column.test.ts`.
- **Hosted two ways** — `EditorShell` in `card-bits.tsx`: `frame="card"` is today's (+) card; `frame="bare"` drops the
  shell so the composer can host the same editor inside the text box (Unichat part B mounts it).
- Rules in `apps/web/lib/chat-deal.ts`: `suggestedCounterCentavos`, `counterContext`, `openCounterBy`, `planBalance`,
  `fillTheRest`, `bookItCap`.
- 🔒 `apps/web/lib/chat-deal.test.ts` (tests 5–8) and `apps/web/lib/quote-receipt.test.ts`.
- `scripts/motion-raw.baseline.json` lowered by one: the removed stepper carried the file's one raw duration.

REMOVED, deliberately: Change quote's step-by-step walk (Add · Change · Remove → which line → price → review). Every
change it made is made on the receipt; "From your catalogue" is still offered as "Add from your catalogue".

NOT built here — each needs data that does not exist yet:
- **Accept → "Book it", capped by what is free.** No booking stores how many of a line were booked, and the count
  already out on a date is server-only (`service_card_bookings_on`, service role). The rule is ready
  (`bookItCap`); the step needs a per-line booked quantity and a host-readable free count.
- **Terms on the quote** (the drawing's Terms row): a quote has no terms field.
- **Editing availability from the tag**: the tag is read-only here; the style is set on the service card.

SPEC IMPACT: None
