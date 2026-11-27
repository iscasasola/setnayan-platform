## 2026-11-27 · fix(supplier numbers): one reader per number on Today, Shop, Collections and Clients; real loading screens (L6)

Lane L6 of the 27 Nov supplier walk. Each figure a supplier reads in two places now comes from one rule.

- **S2 · Rating.** Shop › Analytics printed the Bayesian ranking average (4.2 ★) and Your page the raw average (4.7 ★).
  Both, plus the reputation card's "Overall rating", now read the trusted aggregate that the Shop cover and the public
  shop page already use (`vendor_trusted_review_stats`), through one rule: `lib/shop-rating.ts` (`shopRatingOf`).
  A refused read says "Couldn’t load", never "No reviews yet". Your page drops its own `vendor_review_stats` read.
- **S3 · Portfolio.** Today counted distinct photos, Collections counted the raw list (8 vs 10). Both, and Your page,
  now count through `portfolioPhotoKeys` / `countPortfolioPhotos` (`lib/portfolio-count-label.ts`).
- **S3 · Views.** Today counted 28 days, Your page 30 (207 vs 214), through the same reader. Both now count the shop's
  one window, Analytics' "Last 30 days" (`lib/shop-count-window.ts`). Today's Views and Inquiries say "last 30 days",
  with the words built from the number.
- **S3 · Storage.** The bytes already matched. The Shop cover said "1 MB" (`storageWords` rounds up) where the Plans
  meter said "62 KB". The cover now uses the meter's `meterWords`.
- **A4 · Handled by.** On Clients the row read "Handled by  Handled by ▾" and named nobody. It now says the words once,
  with the person's name, and draws nothing when nobody handles the client.
- **S5 · Event names.** The chat title shortened "Ana & Ben" to "Ana's Wedding" while Clients said "Ana & Ben ·
  Wedding". The chat title now keeps every host's first name ("Ana & Ben's Wedding (Dec 12)"), through
  `eventHostsWords`. One person's name and an event title read as before.
- **S10 · Hosted by.** The shop's own owner and team are no longer listed as a client's hosts on Clients
  (`lib/supplier-event-lines.server.ts`, read in the same first round, so Today's trip depth holds).
- **S4 · Loading.** `/vendor-dashboard` drew a skeleton of the retired home. It now draws Today's own shape in Ghost
  style (cover · five number tiles · "Needs you today" rows). Chats gets a list skeleton instead of a feed of cards.
  `/dashboard/billing` gets its own receipts skeleton. Billing starts the shop's lists beside the VAT read, which saves
  one round trip.

Guards: `lib/shop-rating.test.ts`, `lib/portfolio-count-is-one-rule.test.ts`, `lib/shop-count-window.test.ts`,
`lib/supplier-numbers-say-one-thing.test.ts`; updated `lib/business-doing.test.ts`,
`lib/one-event-one-chat-title.test.ts`, `lib/supplier-today-v2.test.ts`, `today-stats-each-jump.test.ts`.

SPEC IMPACT: Today's counting window moves from 28 days to Analytics' 30 days; the supplier chat title names both
hosts ("Ana & Ben's Wedding"). Both are raised to the owner in the PR for a DECISION_LOG row.
