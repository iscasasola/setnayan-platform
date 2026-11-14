## 2026-11-14 · fix(template): T01 follow-up — the 44 px floor on the client card's buttons and links

W1's re-walk of #7642. Shared pieces only (ActionButton · AskSubmit); tokens only.

- **Under 44 px → ActionButton:** booth "Save to my booth" (was 40) · "Remove the words" · "Remove poster" (both
  bare underlined words) · "View shared photos" (an 18–20 px text link) → info ActionButton.
- **Save note** → AskSubmit (44); its remind-me date box 44 high with a 13 px value.
- **Press at 44 without growing:** the note row's Mark done / Reopen / Delete, the section tabs on the customer card,
  "Their receipt" on Money and Payment, the fee lock's back link, "Turn on Papic Challenges".

Not changed here — the files belong to open PRs (#7647 · #7648 · #7544): "View quote" and the chat "Message"
(`app/_components/chat-message-stream.tsx` and the chat pieces, T06 #7648), the Quotation labels
(`app/_components/proposal-maker.tsx`, #7647), "Open mood board →" (`clients/[eventId]/page.tsx`, #7647 · #7544).

SPEC IMPACT: None.
