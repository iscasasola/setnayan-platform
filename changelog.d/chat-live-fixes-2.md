## 2026-11-16 · fix(chat): live booking-chat text faults, round 2 (CHAT-19 → CHAT-33)

Round 2 of the 16 Nov walk (supplier testnayan4 · couple testnayan3). Wrong, broken or raw text only — no redesign;
the CHAT-09 layout (plan card, strip, jump pills, where the poll/decision opens) is untouched.

- CHAT-19 · a booked client's ＋ draws "Change quote" (supplier) and "Counter with a price" (couple) SHUT with the
  reason and the way forward ("Booked at this quote · … change order …") — never hidden — `booked` on
  `supplierPlusRows`/`hostPlusRows`; the locked quote card and the guest-count card point at the shipped change-order
  flow (`supplierChangeOrderHref`, the client's Schedule tab "Change orders → Propose a change").
- CHAT-20 · "See every version" and "Report a problem" wait for the ＋ sheet's own history step-back
  (`afterSheetStepsBack`) before opening, so the step-back no longer closes/overtakes them; one version = greyed row.
- CHAT-22 · the "Someone —" stand-in display name no longer wins over the real first name (`chatHostsFrom` →
  `realNameOrNull`).
- CHAT-23 · Details: service label via `displayServiceLabel` (not `lights_sound`); "Paid so far" only with a real ₱;
  no Message button while the chat exists.
- CHAT-24 · a passed due date reads "due now" (`scheduleDueText`); no payment method beats "hasn't finished
  confirming" (`not_yet_no_methods`).
- CHAT-25 · `jumpTo` scrolls the page when there is no inner scroller — ＋ drafts come into view on the couple's side.
- CHAT-26 · the running-topic title reads `PLUS_CARD_TITLE` ("Log a payment", not "Logpay").
- CHAT-27 · payment pins jump to the live quote's money step (`#chat-money-step`).
- CHAT-28 · the client ⚙ line says what it holds; the "who looks after this client" picker is needs-owner.
- CHAT-29 · a day held by this very event reads "Booked", not "Not available".
- CHAT-30 · "Wrapped up this <event type>?" via `eventTypeWord`; the per-event branding notice says what the couple sees.
- CHAT-31 · `valid_until_pick` → "Date"; the gift cap no longer calls the fee a booking fee when none is charged.
  CHAT-31 (third) · "Update this quote" showed ₱10,500 for an accepted ₱8,750 quote: the stored "Crew meal ₱1,750" seeds as a line and the builder's crew state also defaulted to "charge 5 × ₱350", so it was counted twice. A revision now opens with crew 'included', as `lib/quote-revision-seed.ts` already promised. Measured from the live row (one sent version, no per-guest line). Held by `lib/a-revised-quote-counts-its-crew-meal-once.test.ts`.
- CHAT-32 · Payment shows the same `firstPaymentStatus` line Details shows.
- CHAT-33 · the Hub says "Crew for the day" and "View only — ask the hosts" once.

SPEC IMPACT: None
