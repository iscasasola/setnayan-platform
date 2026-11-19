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
- 🔒 `apps/web/app/_components/chat/cards/the-card-kinds-are-readable.test.ts` — the contrast arithmetic for all 36
  ink/fill pairs (the contrast lint cannot see a class map), the one-look rule, and the width cap.

NOT built here (each needs data or a file outside `chat/cards/`): the photo album grid and the documents list card
(attachments are drawn by the stream, one per message), the meeting card's date tile and the sent quote / payment
cards (drawn outside this folder), and the not-sent-yet draft frame (`chat-step-card.tsx`).

SPEC IMPACT: None
