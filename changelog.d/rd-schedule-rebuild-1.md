## 2026-09-27 · feat(schedule): the Event Day becomes a time rail, and Announce lives on the Schedule

Schedule rebuild, slice 1 — the approved prototype `prototypes/schedule_redesign_2026-09-25.html`
translated onto the data the page already has.

- **The day as a rail.** Each moment sits where its time is and is as tall as it runs. Tap a moment
  for the one inspector (side column from 1024px, a panel from the bottom on a phone); drag it to
  move it, drag its edges to resize — everything lands on 5 minutes and the ticks show only while
  dragging; tap an empty time to add a moment there; the eye on every moment shows or hides it from
  guests; "Shift everything after" for a day running late; overlapping moments sit side by side.
- **Who can change it.** Hosts and a coordinator the hosts approved (`schedule: 'edit'`) — the same
  rule the write policies enforce (`resolveBroadcastAuthority`). Everyone else reads: no Add, no
  Shift, no gaps, an eye that says but cannot be pressed.
- **Supplier requests** are drawn as dashed ghosts where they asked, with one Requests inbox
  (compare Now → Asked, Approve / Decline) over the shipped `event_schedule_suggestions`.
- **Announce** on the Schedule header for the couple and an approved coordinator, before the day and
  on it, through the one existing channel (`sendCoordinatorBroadcast`). It says honestly that guests
  see a pre-day announcement on the day. The day-of Overview box stays.
- The live run-of-show strip (`RunOfShowHeader variant="strip"`) is drawn only on the day.
- Host / MC (segments, questions, a note) move behind one tool; the emcee script is a toolbar icon.
- Travel events keep their shipped list view.
- First-visit tour `customer_schedule_v1`.
- No new server actions, no migration. `updateScheduleBlock` also accepts `block_type`.
- Guards: `lib/schedule-rail.test.ts` (the wall-clock round trip and the rail arithmetic),
  `schedule/the-day-is-a-rail.test.ts` (renders the rail: position, eye, roles, ghosts, Announce's
  channel and honesty, writes only through the page's actions, the tour); the
  `a-birthday-has-no-pre-ceremony` guard now also covers the rail's phase labels. Each was seen red
  by sabotage and restored.
- Brief for every slice: `build-sessions/SCHEDULE-REBUILD-BUILD-BRIEF-2026-09-27.md`.

SPEC IMPACT: None to the decisions — this implements DECISION_LOG "SCHEDULE REDESIGN PROTOTYPE
APPROVED", "WHO SETS UP THE SCHEDULE, AND HOW SUPPLIERS REQUEST CHANGES" and "WHERE ANNOUNCEMENTS ARE
TYPED". Flagged, not changed: a pre-day announcement reaches guests only inside the day-of window
(guest reader in `app/[slug]/**`, owned by the stage builds).
