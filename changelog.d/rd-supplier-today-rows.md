## 2026-10-08 · feat(supplier): Today is rows — the queue under one Next card, the event-day card, an honest money number, the outcome toast (S-PR1)

Second PR of the supplier dashboard redesign (corpus
`SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Today" + § 6 row S-PR1;
prototype `prototypes/supplier_dashboard_2026-10-08_fable.html` frames 01 · 02 ·
15 · 31). Stacked on S-PR0.

**What a supplier sees.** One Next card with its place in the queue ("1 of 3"),
its main verb in the colour of its meaning (Reply blue · Agree and money green ·
Run the day terracotta) and a grey second button; three numbers — *waiting on
you · events this week · to come in*; Coming up (three rows); **Also waiting**
(the rest of the queue, one hairline row each, "2 of 3"); one Shop row. The
"Everything else" block (`#today-all`) is gone.

- **Also waiting** — each row opens its answer IN PLACE: the same forms and the
  same server actions that were the desk's cards, unchanged, one open at a time
  (`<details name>`; no client code). The plan drew each row as a door to the
  customer card; two answers (a date change, a delete request) are given on
  Today and nowhere else, so a door would have left them with no place to be
  answered.
- **A date change is answered on the Next card** (frame 31): Move · Unlock post
  the shipped `vendorAnswerDateChange`; the refund sentence is said under the
  buttons, before the press.
- **Event day** — the Next card goes dark, its title is the event, **Run the
  day** (brand) + **Chat** (the event's own thread).
- **Honest numbers** — an unread payday says "couldn't load" where the money
  would be (it was a bare "—" over "owed to you"); an unread desk says so on the
  card (danger wash, "Try again") and on the first number. Never 0, never ₱0.
- **Outcome notices are a toast** (`SupplierToast`) — the three sentences
  (booking answer · date answer · payment never arrived) as one dark pill above
  the bottom bar; the server draws it first, and a refusal never leaves by
  itself.
- **Banners** — findability and first-steps are `pickSupplierNext` rules
  (`findable`, `setup`): the Next card when they win, a row under Also waiting
  when a busier rule does. The credit-expiring notice and the payout nudge have
  NO rule, so each is kept as a row with its own words. Every unpaid booking fee
  is still listed with its own Pay (`<BookingFeeBills>`; the `fee` rule knows
  one bill). The award and the milestone ride on the Shop row's line. "Nothing
  to answer" is kept as quiet rows. The token note, Ongoing and Upcoming
  schedules are removed (the queue and Coming up say them).
- `pickSupplierNext` is unchanged — nine rules, same order, same words.
  `lib/supplier-today.ts` gains `supplierWaiting` (the rows), `nextLook`,
  `nextSecond`, `nextMeta`, `waitingOnYou`, `ANSWERED_ONLY_ON_TODAY`.
- `app/_components/next-card.tsx` (shared, server) gains four optional props for
  its `actions` variant — `meta`, `counter`, `day`, `note`; the couple's Home
  passes none and is drawn exactly as before.
- Guards: new `today-is-rows.test.ts` (12 tests, on real markup); the button
  sweep grows to Today's page, first screen and toast; nine existing guards
  re-anchored to the new shape with their meaning kept
  (`the-today-page-speaks…`, `an-unread-desk…`, `the-upcoming-row…`,
  `a-count-you-can-tap…`, `the-supplier-app-lands…`, `the-credit-warning…`,
  `money-reads-are-honest`, `the-four-small-lists…`). The desk's own guards
  (`answers-desk`, `the-supplier-can-answer`, `the-date-change-reaches…`,
  `the-fee-finds…`, `deposit-pay-step`, …) pass untouched.
- Baselines regenerated: `port:baseline` (Today no longer links
  `/vendor-dashboard/earnings`, `/payday` (now the payday landing) and
  `/clients`), `lint-no-card --update-baseline` (−2 card lines),
  `ugat:screens`.

No migration · +0 exported server actions · no new rule in `globals.css` · the
new client code (`SupplierToast`) is imported only by the supplier's Today.

SPEC IMPACT: None to the plan's intent. Ten deviations from the letter of row S-PR1 / the prototype are recorded with a recommendation each in the corpus `SUPPLIER_DASHBOARD_BUILD_STATUS_2026-10-08.md` — chiefly: Also-waiting rows open the answer in place (not the customer card); the booking-fee bills, the credit notice, the payout nudge and "Nothing to answer" are kept; the event-day numbers and "Also today" rows wait for the Event Hub's reads (S-PR11).
