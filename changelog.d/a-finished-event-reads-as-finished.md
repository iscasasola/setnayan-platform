## 2026-08-21 · fix(lifecycle): a finished event reads as finished — the app kept saying "event day soon" the morning after

Owner, opening his Movie Night (2026-08-20, Asia/Manila) at 08:33 the next morning, after a first fix had already shipped:

> *"nothing changed. i can still invite. prepare for event day, etc"*

He was right. PR #4651 built the After phase's Overview and rail — but **the phase itself had not arrived, and could not for another 30 hours.**

---

## The boundary said two and a half days

`getMenuLifecyclePhase` returned `after` only when `cleared_at` was set **or `now > event midnight + 60 hours`**. His event was still `dayof`, and would have stayed so until noon on the 22nd. Every after-phase surface was correct and unreachable.

🚨 **AND THE PRODUCT ALREADY HAD AN ANSWER IT WAS NOT USING.** `lib/event-board.ts` → `isFinishedEvent` has always said an event is finished when **its last day is before today** (`lastDay < todayISO`), and three surfaces read it — the My Events board's Finished shelf, the chapter-participation check, the Studio app's event picker. **So the board filed his Movie Night under "Celebrated", and the dashboard that same card opens greeted him with "EVENT DAY SOON".** Two answers to one question, one click apart.

**The new rule: it is over at 06:00 in the venue's clock on the day after the last day.**

⏰ **The six hours are the only thing this adds and they are deliberate.** The board flips at midnight; a Filipino reception routinely runs past it, and killing the day-of desk mid-party is the exact failure the window was widened to fix on 2026-08-05. The two definitions now agree at every hour a person is realistically looking and disagree only between midnight and dawn — pinned in both directions by a test so neither can be "fixed" alone.

⚠ **The old T+60h rule was DELETED, not kept beside it.** It was not merely redundant: `event_date + 60h` lands in the middle of day three, so a five-day festival **declared itself finished while it was still running**. The rule now anchors on `COALESCE(event_end_date, event_date)` — the same value `isFinishedEvent` and the full-res retention floor already read. And the middle days of a multi-day celebration used to fall through to **`plan`**, telling a family in the middle of their own festival to go and plan it.

⚠ **The next midnight is a CALENDAR day, not `+24h`.** Adding a fixed 24 hours lands an hour either side across a DST boundary. Asia/Manila has no DST, which is exactly why it would have gone unnoticed.

## "EVENT DAY SOON" was never going to be fixed by the phase

The banner at the very top of his screenshot renders **above every branch** the last fix touched, unconditionally, from its own `T-3d .. T+1d` window. So does the silent preloader beside it, which was re-downloading the whole event bundle the morning after to serve a venue nobody is going back to.

🔑 **Both are now TOLD, from the one resolver.** Narrowing their own windows would have given the app a third opinion about when an event is over — and it already had four.

## The guest list did not know the event had happened

Owner: *"i can still invite."* **The Guests page never read the event's date at all** — no date, no phase, no lifecycle import — so it could not have known. It now asks the same resolver, and after the day: the masthead's "Invite guests" and "Arrange the room" become **"Who came"**; a one-line wrap strip leads with the arrivals record and the story; the name box recedes behind *"Still adding someone? — the list is open"*; and the zero state stops saying *"Start by adding the couple's first invite."*

🔒 **Receded, never removed — and asserted, not promised.** The cousin who turned up unannounced still belongs on the list, and a host writing thank-yous needs them there.

## Receding was not enough, and here is the proof

PR #4651 folded the planning dashboard behind a disclosure. **One click down it still told a finished celebration it was 0% planned, that locking a venue was overdue, and headed its digest "Needs you this week."** A wrong statement one click down is still a wrong statement.

`<EventDashboard>` took `dayOfActive` — a boolean answering only *"is it the day itself"*, whose sole use was painting one card dark. It is now told the phase, and gates: today's-one-thing · the Book/Pick/Role decision groups (**Settle a payment stays — a bill is still a bill**) · the shimmering % planned bar · the digest heading · the RSVP nag · four "Around your event" empty states.

**And the countdown was reading the wrong clock.** `daysUntil` anchored on the runtime's own midnight — UTC on Vercel — so between 00:00 and 08:00 Manila the day after, it still returned 0 and the hero read *"It's your event day"* while the rest of the page had moved on. It now uses `eventDateToEpoch`, which exists because a bare `Date` parse broke a countdown once already.

## The marketplace was scolding him about a party that was over

Every booking deadline is computed **backwards from the event date**, so once it passes, `daysToFloor` is negative for *every* category: a red **"⚠ Nd overdue"** chip on each, N growing by one a day, forever. Fixed in `timelineStatusOf` — **not at the chip** — because that one function also feeds the Coverage Strip's ordering and the folder pills; patching the chip would have left the strip sorting dead deadlines to the front. `locked` still wins, and an outstanding ask still reads `awaiting`.

## "Your last stretch" is not what you say the morning after

Two ladders read months-to-date and **neither had a negative branch**, so a celebration that finished last night fell through the bottom of both — the Suite and the Studio each opened with *"Your last stretch."* The **rung** is now shared (`roadmapLedeStage`, beside `monthsUntil`, the one place that knows the sign); the **words** stay each hub's own, because "event" and "day" is real copy, not drift.

## Two clocks, fifteen lines apart, on the guests' own page

`app/[slug]/page.tsx` handed the venue's timezone to `getDayOfPhase` and **not** to `getLifecyclePhase` fifteen lines below it. The zone is now resolved once and both are given the same answer, and all six call sites pass it.

⚠ **But the missing timezone was NOT the cause of the symptom, and that matters.** At 08:33 Manila both the UTC anchor (+24.5h) and the venue anchor (+32.5h) sit inside the 36-hour live window — so the guests' page said *"Happening now"* the morning after because of the **window**, not the zone. It now delegates to the one boundary. `cleared_at` is deliberately **not** passed: closing out the day is a host action and must not retire the guests' page out from under them mid-celebration.

## Also

- The **close-out door** — the only inbound link to `/clearance` in the whole app — was the last element under seven cards. Moved above them. Still exactly one door.
- `after-summary.ts` now uses the **shipped** `countGuestsByEvent` (which excludes soft-deleted guests, as the guest list does) and the **shipped** `BOOKED_VENDOR_STATUSES` (so eleven shortlisted caterers stop counting as eleven suppliers who worked the day).
- The summary's *"N still waiting on a word from you"* is **gone**: it subtracted reviews-written from suppliers-on-the-list, and a review is not even open until the supplier marks the job done or a month passes. A prompt to do something the product would then refuse is worse than no prompt.

## Deliberately NOT changed

- **`getDayOfPhase`, `isEventDayActive` and all three window constants.** Only the menu phase moved, so the venue photo wall, the live console and the day-of surfaces keep exactly the windows they have.
- **The day-of takeover**, owner-signed-off and already correct.
- **`isFinishedEvent`.** Widening the board's rule to match would have touched three consumers and their guards to buy nothing a person can see.

## Verification

- **21 sabotages, every one measured by occurrence count before → after, every one RED**, baseline green either side. Two of them caught **my own tests passing for the wrong reason**: one mutation did not land at all (unmeasured ⇒ proves nothing), and one landed and stayed GREEN because the assertion ran at the real wall clock, where the *old* code path already returned the right answer. `getLifecyclePhase` gained an injectable `now` and the instant is now pinned inside the window where the two answers differ.
- An existing guard caught this work too: `vendor-free-surfaces.test.ts` requires `marketplaceEnabled` to be the **leading** conjunct on `topPriorityTask`, and the first edit reordered it.
- Full unit suite **9131 pass / 0 fail**. Typecheck, `next lint` and twelve lint guards clean. The new file runs green under **Asia/Manila · America/New_York · Pacific/Kiritimati · UTC**.
- Every column the new reads name was **verified to exist in production first**.

SPEC IMPACT: None — no SKU, price, schema or migration. One product rule changed: an event is over at 06:00 the morning after its last day, replacing "60 hours after its first midnight".
