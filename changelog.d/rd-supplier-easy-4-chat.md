## 2026-10-14 · feat(supplier-chat): simpler supplier dashboard step 4 — the chat's answer line, one ＋ tools sheet, the booking ask in the chat, and the one-screen quote

Translates the approved prototype (`prototypes/supplier_easy_dashboard_2026-10-14_fable.html` — `SCREENS.thread`,
`SHEETS.tools`, `SHEETS.decline`, `SCREENS.quote`, `SCREENS.couplequote`) onto the shipped supplier conversation
(`vendor-dashboard/messages/[threadId]`), extending the shipped components:

- **Answer line** at the top of the conversation: the couple's initials · their date (a door to that day on Dates) ·
  Free / N more fit / Full / Not available / Schedule not set / Booked — the day read off the supplier's own schedules
  through the Dates screen's own `buildCustomerCalendarMonth` (`lib/thread-day-answer.ts` + `.server.ts`: four narrow
  reads, only for an unbooked thread with a date; a failed read says nothing, never "Free").
- **Talk to them** — the shipped accept-to-reply in plain words ("Say yes to talk — nothing is booked yet").
- **Quick replies** while the couple spoke last (the shipped `sendChatMessage`, plain forms); "Yes po, that day is free"
  only on an open day.
- **ONE grey ＋** beside the message field (Send stays the one main) opens a Tools sheet of every tool the thread has —
  Send a quote · Answer their booking ask (only while asked) · Ask for a payment · Confirm a payment they sent · Propose
  a date or meeting · Your call time · Share a file or the contract · Offer another service · Call them · Guest count
  changed · Mark won or lost · **Report a problem** (→ the shipped `/vendor-dashboard/disputes`). Tools that cannot
  open yet are shut with their reason, never hidden. It replaces the customer rail's Tools column and the composer's
  🧾 / 📞 icons; every row opens the same panel or page, posting the same server action.
- **Answer their booking ask** in the chat: the customer card's shipped `LockRequestAnswer` — the fee forecast ABOVE
  Agree, Agree = `vendorAgreeToLock`, the after-Agree sentence and its Pay door exactly as live. Turn it down: Why ▾ +
  an optional line (`DeclineReasonFields`, joined into the one `reason` field), no Undo — on the customer card too.
- **The custom quote is ONE screen** (the shipped `ProposalMaker`; the 2026-09-22 five-step walk retired with
  `lib/quote-stages.ts`): Start from (card · a saved quote · blank) · lines tap-to-drop · guests counter · From your
  catalogue (card add-ons + `vendor_package_items.is_default_included = false`, read when the quote first opens) · a line
  just for them · discount + reason (nothing pre-filled) · crew meal · transport · how they pay (three plans + the
  editable rows) · Setnayan gift · good for · booking fee line · Save this quote · As they see it (the couple card's
  own lines, `QuoteCardLines`, shared with the conversation) · Send.
- Migration `20271269180462_saved_quote_draft`: ONE nullable `vendor_proposal_templates.quote_draft jsonb` so a saved
  quote keeps its lines (`lib/saved-quote.ts`, parsed as untrusted). Old templates load as before (package + body).
- Dev lab `/dev/supplier-chat-lab?m=inquiry|tools|ask|agreed|quote|full[&booked=1]`.

SPEC IMPACT: The supplier's quote is now one screen (DECISION_LOG 2026-10-14 ✅ APPROVE, prototype `SCREENS.quote`),
superseding the 2026-09-22 five-step quote walk; saved quotes keep their lines (new column
`vendor_proposal_templates.quote_draft`). A corpus row recording the build is for the assembler to add with the other
simpler-dashboard steps (six builders editing DECISION_LOG in parallel would collide).
