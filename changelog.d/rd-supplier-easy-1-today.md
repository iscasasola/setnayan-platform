## 2026-10-14 · feat(supplier · today): the simpler Today — step 1 of the simpler supplier dashboard

The owner-approved simpler supplier dashboard (DECISION_LOG 2026-10-14 ✅ "APPROVE: THE SIMPLER SUPPLIER DASHBOARD";
prototype `Setnayan/prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, SCREENS.today), built on the live
S-PR1 Today (`supplier-today-first-screen.tsx`, `lib/supplier-today.ts`) — extended, not redrawn.

- **One assembly, one drawing.** `lib/supplier-today-view.ts` (`assembleSupplierToday`, pure) decides every part of
  the screen; `_components/supplier-today-screen.tsx` draws it with the shipped answers handed in. The page and the
  dev lab (`/dev/supplier-lab?easy=normal|setup|ask|eventday|locked|hallask|agreed&sup=parish|caterer|studio|venue`)
  share both, so the lab shows what ships.
- **Next card** keeps LIVE's nine rules (an overdue fee never jumps ahead of a couple's ask). New: the couple's
  initials; a booking ask is answered ON the card with the shipped `LockRequestBody` (fee named above Agree · Agree
  to this booking · Turn it down with its reason · Chat when the thread is known); a full hall that day and an
  unapproved shop said before Agree; "Move to Sun 25 Oct" · "Unlock my service"; the event-day dark card says
  "Today · live since 12:00", the event, where and how many; "Nothing waiting · Next: … · See the month"; a fee card
  names the lock before Pay.
- **Status line** after an answer sits under the Next card with its door — fee held → "You said yes. Pay the booking
  fee and we'll tell the couple their booking is confirmed." + **Pay the booking fee**.
- **Numbers** count up (`TodayFigure`, reduced-motion off-switch via `useCountTo`): waiting on you · this week
  (Setnayan + outside) · to come in; on an event day waiting · next moment · checked in, plus **Also today**.
  None of the day's numbers while an unpaid fee keeps the day locked.
- **Coming up** carries the bookings from outside ("from outside") and the schedule's / hall's name when a shop has
  more than one.
- **Also waiting**: every row has its round icon and the prototype's words — Date change (2 d) · Cancel request
  (Agree to remove it in the delete look · Keep it for now) · Mark it done · Reply to a review · Finish quote draft →
  · Contract draft → · Ask lapsed · Dispute open → · Where couples pay you (Set up) · Credits expiring. The closed
  lines join the same list (no second "Nothing to answer" heading).
- **Booking fees** (`BookingFeeBills today`): "Booking fee · couple" · "₱X · due Tue 20 Oct / overdue since … ·
  Setnayan introduced this couple to you on …" · grey Pay; the gate's lock sentence said once under the bills — for
  every unsettled bill while enforced (checklist D2 X1), only an overdue one while not.
- **Shop row** pill Checking · Live · Not yet, "details N of M"; **How is business** ("312 looked · 14 asked").
- **First steps → six**: Your details · Add what you offer · Send your documents · Mark the days you are not
  available · Add the bookings you already have · Show your QR ("N of 6"; approval stays a never-actionable 7th row).
- **Today does not grow** (request census, fake-client harness, origin/main vs this branch, every scenario equal:
  normal 32→32 · booking ask 37→37 · event day 32→32 · setup 32→32). Three single-column `vendor_profiles` reads →
  one (`readTodayShopRow`); schedules + outside bookings + days off in one embedded read; views only for an approved
  shop; on an event day the money read is skipped and the day's two reads take its place. Wave 2 reads now run in
  one parallel round (were five rounds one after another).
- New guard `the-simpler-today-keeps-every-door.test.ts` (11 tests, 12 sabotages red). Re-pointed (never weakened):
  `today-is-rows`, `the-today-page-speaks-to-every-supplier`, `an-unread-desk-is-not-caught-up`,
  `a-count-you-can-tap-goes-somewhere`, `the-supplier-app-lands-where-it-says`, `the-credit-warning-shows-on-today`,
  `the-fee-finds-the-supplier`, `the-four-small-lists-read-to-the-end`, `the-yes-says-what-the-couple-heard`,
  `the-chat-card-locks-in-place`, `the-lock-step-tells-the-truth`, `the-date-change-reaches-the-supplier`,
  `answers-desk`, `deposit-pay-step`, `money-reads-are-honest`, `the-badge-has-a-deadline` (bill line),
  `vendor-first-steps`. Port baseline + screen map regenerated.
- Shared files touched (additive props): `app/_components/next-card.tsx` (`who` · `eyebrow` · `rows`),
  `app/_components/booking-fee-notice.tsx` (`today` row), `supplier-toast.tsx` (`line`), `overview-sections.tsx`.

SPEC IMPACT: None — builds the approved 2026-10-14 design. Open owner questions are in the PR body (supplier Papic
credits do not expire in the code, so "Credits expiring" shows the plan credit; "How is business" says "asked"
where the prototype says "booked", one read cheaper).
