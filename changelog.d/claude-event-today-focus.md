## 2026-11-20 · feat(event-today): the event's Today runs like admin Focus and the supplier's Today

Owner, 20 Nov, on the drawing `prototypes/event_today_focus_2026-11-20/` (v3): *"make the Today of the event dashboard
run like the Focus of Admin and Today of Suppliers Dashboard"* · on the dark event card: *"keep it, the information
there is vital or maybe you can make it look better"* · *"Yes, build it"*. Stacked on Today v3 parts 2–5 (#8037).

- **One list under the event card, by urgency.** The "To do · soonest first" block and the Today pill lines for asks
  are replaced by "Needs you today N": payments that are late or due soon, the plan's three soonest tasks, and every
  ask are rows of ONE list — red (Overdue · Today), amber (Soon), then the rest, always a word plus the colour
  (`lib/event-today.ts`, the shared `orderByUrgency`). Every level comes from a deadline the app already keeps (a
  payment's band, a task's due date, a date change's reply deadline) — no new number.
- **Tap, drag right, drag left** — the shared parts from #8032/#8037 (`useTodayDrag`, `TwoWayPanes`), never a third
  shape. A tap opens the row as a card where it sits with its answer inside: a payment's "Pay ₱X" (the shipped Pay
  door), a task's shipped tick, "Send the invitations", a coordinator's Limited · Full access, the Mood Board's Keep ·
  Decline and Undo, a date change's own body. The card ends "Open in <page> ›" and, never on a red row, "Do it
  tomorrow". Drag right opens the page; drag left is "Do it tomorrow"; a red row moves a third and springs back with
  "Urgent · can't go to tomorrow". No delete.
- **"Do it tomorrow" is per host.** Owner: *"one host may choose to do it tomorrow but the other host hasn't so there
  is a change that can be done today"*. New record `event_today_put_offs` (migration `20271354816762`, RLS on at
  CREATE TABLE: own rows, on an event the person belongs to), written by the same `todayPutOff` action with
  `scope: 'event'` — still ONE export. Put-off rows sit under "Tomorrow N", out of the count; a red row ignores any
  record and an unread record list holds nothing off.
- **The event card is kept, redrawn shorter.** Eyebrow, names, ⚙, the countdown on one line ("21 days to go · Sat 12
  Dec", still the Date Finder's door, the place kept), the count line "N things need you" (the strip's item + the rows
  on Today), and the strip with its level word ("Overdue" · "Today" · "Soon") in place of "Now" when it has one.
- **Now never repeats below, widened.** The strip's item is left out of the list, and the Budget card leaves out every
  payment the list shows as a red row (`paysHeldByToday`). A payment that is only due soon stays on the Budget card,
  as drawn.
- After the plan's three tasks, ONE row "N more plan tasks this week ›" (the plan's own figure less what is on
  screen), then the kept line "N% of the plan done · All N this week ›".
- A read that failed is a "couldn't load" row — never folded into "Nothing needs you today".
- The asks are read once by the page (`readCoordinatorLevelAsks`, `readMoodBoardAsks`, `readDateChange` — the reads
  their doorways ran) and handed both to the list and to the doorways. The day-of console and the after-the-day
  screen keep their Today lines, unchanged. Everything below the list is unchanged.
- The heading is not a second pinned row: Home pins ONE row, the card (owner 2026-10-27, "one row per menu").
- Rosters for the new table: exposure baseline, user-FK baseline, the personal-data export, export completeness and
  erasure coverage.
- Guards re-aimed on purpose (each still fails on the fault it was written for): see the commit message. New:
  `lib/event-today.test.ts`, `app/dashboard/[eventId]/event-today-is-focus-shaped.test.ts`.

SPEC IMPACT: None — drawing + rulings already in specs (DECISION_LOG 2026-11-20 rows "EVENT TODAY …", prototypes/event_today_focus_2026-11-20/)
