# Shots · chat-live-fixes-2 (390 × 844, @2x, `next dev` labs, dummy lab env)

| Shot | CHAT | What it proves |
|---|---|---|
| chat-19-couple-plus-booked.png | 19 | Couple ＋ on a booked chat (`/dev/chat-lab/t/…a1?booked=1`): no "Counter with a price"; Negotiate starts at Propose a payment plan |
| chat-19-couple-plus-not-booked.png | 19 | Same chat unbooked: "Counter with a price" still offered (the hide is booked-only) |
| chat-19-supplier-plus-booked.png | 19 | Supplier ＋ booked (`?side=vendor&booked=1`): no "Change quote"; Payment / Form / Ask for access open |
| chat-19-supplier-plus-not-booked.png | 19 | Supplier ＋ unbooked: "Change quote" offered; Payment / Form / Ask for access shut "Opens once they book you" |
| chat-19-locked-quote-change-order-link.png | 19 | The locked Change quote card now carries "Propose a change order" → `/vendor-dashboard/clients/<event>?tab=schedule` (`/dev/chat-cards-c-lab?m=quote&requote=deal_locked`) |
| chat-20-versions-row.png | 20 | "See every version" with one version is drawn greyed with its reason, never a press into nothing |
| chat-20-report-a-problem-opens.png | 20 | Tapping "Report a problem" in the couple's ＋ navigates to `/dashboard/<event>/disputes` (the request was made; the lab has no session, so the page then forwards to /login — that login screen is what is shown) |
| chat-25-26-draft-in-view-log-a-payment.png | 25 · 26 | Dropping a ＋ card brings it into view (draft at y≈666 of 844, was ≈1114) and the running topic reads "Log a payment", not "Logpay" |
| chat-33-hub-pages-view-only-once-rf.png | 33 | Hub · The event's pages (booked, your service): "View only — ask the hosts for more." once (counted: 1) |
| chat-33-hub-crew-heading-once.png | 33 | Hub · crew: "Crew for the day" once (counted: 1) |

Lab edits made for these shots (lab-only, never shipped): `chat-lab/t/[threadId]` passes `booked` to the couple ＋;
`chat-cards-c-lab` takes `&requote=deal_locked`; `supplier-lab/hub-lab.tsx` drops the per-row "View only" line, mirroring the page.

## Not shot — no lab renders these without a signed-in database

- CHAT-22 (real name in 🔒 picker / members strip) — `lib/chat-hosts-name-no-stand-in.test.ts`
- CHAT-23 (service label, Paid so far, no Message button) — render-only on the signed-in couple workspace; no test
- CHAT-24 (past due date; no payment method) — `lib/accepted-quote-terms.test.ts`, `lib/deposit-pay-step.test.ts` ("CHAT-24 · …")
- CHAT-27 (Due now pin → money step) — `lib/chat-live-fixes-2-plus.test.ts`; no lab draws a payment-due pin
- CHAT-28 (client ⚙ line; picker is needs-owner) — `app/vendor-dashboard/clients/[eventId]/the-client-settings-line-names-what-it-holds.test.ts`
- CHAT-29 (own booked date reads Booked) — `lib/thread-day-answer-own-booking-reads-booked.test.ts` (the supplier-chat-lab day answer is a hand fixture, not `threadDayAnswerOf`)
- CHAT-30 (event-type word; branding notice) — `lib/event-vocabulary.test.ts`, `lib/brand-your-booth-at-one-wedding.test.ts`
- CHAT-31 (`valid_until_pick` → Date; fee wording) — `lib/quote-valid-until.test.ts`; editor total NOT fixed
- CHAT-32 (Payment reads the same first-payment row as Details) — signed-in clients page only; no test
