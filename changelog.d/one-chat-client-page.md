## 2026-11-19 · feat(clients,chat): the supplier's client page is one chat that holds everything

Owner, 19 Nov: *"can you make it live just as a chat but everything is inside that chat?"* · *"Yes, build it"* — drawing
"Chat holds everything" v3 (artifact S9ScH2PsRzwxd61XxhYtZ6, 13 screens). Supplier side only; the host's side is the
next build.

- **The chat is the page.** The seven-tab row is gone on a phone (kept from 1024 px, beside the always-open chat). The
  client's name raises Details; ⋯ holds Files · Hub · Report.
- **Summary strip, first in the chat's one pinned stack:** Paid ₱ of ₱ (before booking: Deal — "₱45,000 · they ask
  ₱40,000 · good until … · N days") · Next · Forms · Decisions (`ClientChatStrip`, `lib/client-chat-strip.ts`). Each box
  raises the shipped page full screen through `RiseScreen`; closing lands on the same spot in the chat. A refused read
  says "Couldn't load · tap to retry" — never ₱0, never blank.
- **Old `?tab=` links still open** — the chat, with that page risen.
- **One switch, in the text box:** the sliders raise the chips All · Decisions · Forms · Money · Dates · Files
  (`lib/chat-kinds.ts`). The old Chat · Decisions · Files 📎 switch is not drawn beside them.
- **One suggested step inside the box, by stage:** Make a quote → Set an ocular → Ask for ₱13,500. Hides once a word is
  typed.
- **Negotiating:** the (+) groups read Negotiate · Ask & decide · Money · Dates · Files · Report a problem (last).
  "Drop an offer" reaches the already-built Offer card. Every version gains their ask as a column and "You are ₱N
  apart" (`DealSheet`, `lib/chat-deal.ts`).
- **Your lowest price, private** (`vendor_proposal_lowest`, shop-team-only RLS, no host or admin policy). A counter or
  version under it shows one quiet line; it never blocks. The number is only ever the supplier's own input.
- **The first inquiry is a card:** service · date · guests · venue · budget ("Not given" when missing) · Reply with an
  offer (`InquiryCard`).
- **Quiet lines for each deal step:** "Version 2 sent · ₱45,000", "Payment logged · ₱9,000 · Receipt ›", "Liza joined".
- Forms are sent in the chat, never made there.

Guard: `app/vendor-dashboard/clients/[eventId]/the-client-page-is-one-chat.test.ts` (7 tests, each sabotaged red then
restored) · `lib/chat-kinds.test.ts` · `lib/chat-deal.test.ts` · `lib/client-chat-strip.test.ts`.

**Migration:** `20271351728770_the_suppliers_lowest_price_is_private.sql` — new table `vendor_proposal_lowest`.

SPEC IMPACT: None beyond the rows already in `DECISION_LOG.md` (2026-11-19 "GO: the supplier's client page becomes ONE
chat that holds everything" and "BUILD: the one-chat client page, drawing v3").
