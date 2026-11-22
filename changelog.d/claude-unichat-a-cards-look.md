## 2026-11-20 · feat(chat): Unichat part A — cards read at a glance

The chat's cards take the approved Unichat look (drawing `UNICHAT-LIVE-2026-11-19`). Visual only — no data, query,
server action or migration changed; every word, button and behaviour is the shipped one.

- **One shared look** — `KindCard` in `apps/web/app/_components/chat/cards/card-bits.tsx`: a white frame, one kind
  colour (the 3 px left edge + the icon chip), the title first, the kicker under it. The icon is still the topic's own.
- **Nine kind colours as tokens** — `--sn-kind-*` / `--sn-kind-*-bg` in `globals.css` (light + dark), `kind.*` in
  `tailwind.config.ts`. Two inks sit one step deeper than the drawing so they pass 4.5:1 as words: counter
  `#C24E25 → #A8431D`, file `#857F79 → #6B655F`.
- **"Your turn" lifts** — a card that waits on the reader shows a dot + "Your turn" and is the only one with the soft
  lift; every other open card sits flat.
- **A settled card folds to one ✓ line** — the line is the press; open, it shows everything the card held.
- **One signature detail per kind** — counter: the gap pill · payment plan: a bar with one segment per payment ·
  payment ledger: paid-of-total bar · offer: its saving as a pill · form: a ring that fills as answers land ·
  schedule change: old time struck, new time bold · quote rose/fell: the change as a pill.
- **The card does not stretch on a computer** (owner 20 Nov) — the frame caps at 30rem like a message bubble; phone
  unchanged.
- Cards moved onto it: booking ask, inquiry, ask for a change, guest count changed, quote rose, quote fell, counter,
  payment-plan counter, dropped offer, poll, form to answer, schedule changed.
- **Drawing parity pass (20 Nov, drawing-vs-build shots in `build-sessions/shots-unichat-a/`)** — the dark kind fills
  are now the drawing's own tints (`#383123 … #383633`, "its colour at 16% over that side's card"); a settled line
  fills its tint whole in dark (55% in light, as drawn), sits 8 px from its left edge, drops the chevron the drawing
  does not draw, strikes through a line settled without a yes, and can no longer push past the chat's right gutter
  (`min-w-0`). New lab `/dev/unichat-a-lab` (`?side=vendor|couple&scene=open|settled|failed`) draws part A's cards in
  one stream; dev-only, 404 in production.
- **Ship review fixes (20 Nov)** — a booking ask a later line answered "booked" now settles as a yes (✓, not struck;
  `a-booked-ask-settles-as-a-yes.test.ts`, red first) · the drawing's deal marks: ⇄ counter, ≡ payment plan, ₱ quote
  (`DEAL_MARK` in `card-bits.tsx`; every other card keeps its topic's glyph) · the inquiry card's `hasQuote` is null
  when the quotes read failed and says "Couldn't check for a quote" instead of offering a reply as if none existed ·
  a counter whose amount did not load reads "₱ — amount not loaded", never ₱0 (`an-unknown-is-never-drawn-as-none.test.ts`).
- 🔒 `apps/web/app/_components/chat/cards/the-card-kinds-are-readable.test.ts` — the contrast arithmetic for all 36
  ink/fill pairs plus the 72 dark ink × DARK_MODE_STANDARD §2 surface pairs (events and supplier navy) (the contrast lint cannot see a class map), the one-look rule, and the width cap.

NOT built here (each needs data or a file outside `chat/cards/`): the photo album grid and the documents list card
(attachments are drawn by the stream, one per message), the meeting card's date tile and the sent quote / payment
cards (drawn outside this folder), and the not-sent-yet draft frame (`chat-step-card.tsx`).

SPEC IMPACT: None
