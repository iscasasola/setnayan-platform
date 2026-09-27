## 2026-09-28 · feat(schedule): the Event Day becomes a time rail, and Announce lives on the Schedule

The Schedule rebuild — the approved prototype `prototypes/schedule_redesign_2026-09-25.html`
translated onto the data the page already has. Slice 1 (paused 2026-09-27 as `rd/schedule-rebuild-1`)
resumed on top of the timezone hotfix (#rd/schedule-times-in-manila) and finished.

- **The day as a rail.** Each moment sits where its time is and is as tall as it runs. Tap a moment
  for the one inspector (side column from 1024px, a panel from the bottom on a phone); drag it to
  move it, drag its edges to resize — everything lands on 5 minutes and the ticks show only while
  dragging; tap an empty time to add a moment there; the eye on every moment shows or hides it from
  guests; "Shift everything after" for a day running late; overlapping moments sit side by side.
- **Every set of choices is ONE dropdown** — the shared `PickMenu` the Event Hub Maker uses (owner,
  2026-09-27): the moment's phase, the supplier to tag, View as, and on the sheets Starts · Runs for ·
  From · Through · By. A quantity (a start, a length, how late) is a −/+ stepper, five minutes a press.
  On/off (Visible to guests · Start staged) stays a switch. No pill rows, no native selects.
- **Who can change it.** Hosts and a coordinator the hosts approved (`schedule: 'edit'`) — the same
  rule the write policies enforce (`resolveBroadcastAuthority`). Everyone else reads: no Add, no
  Shift, no gaps, an eye that says but cannot be pressed.
- **Supplier requests** are drawn as dashed ghosts where they asked, with one Requests inbox
  (compare Now → Asked, Approve / Decline) over the shipped `event_schedule_suggestions`.
- **Announce** on the Schedule header for the couple and an approved coordinator, BEFORE the day and
  on it, through the one existing channel (`sendCoordinatorBroadcast`). Suppliers never see it. It
  says honestly that guests see a pre-day announcement on the day. The day-of Overview box stays.
- The live run-of-show strip (`RunOfShowHeader variant="strip"`) is drawn only on the day.
- Host / MC (segments, questions, a note) move behind one tool; the emcee script is a toolbar icon.
- Times are the venue's wall clock in a UTC column, read and written as digits (`lib/schedule-rail.ts`);
  the strip's "started 2:12 PM" is a real instant and is listed as such in the timezone guard's
  exemptions. Travel events keep their shipped list view.
- The guest-facing schedule scene on the Event Hub reads the same `event_schedule_blocks` rows
  (`is_public`), so the eye on the rail is the eye the guests see. Unchanged, and now pinned.
- First-visit tour `customer_schedule_v1`.
- `/dev/schedule-lab` — the real rail on the prototype's fixtures with in-memory stand-ins for the
  nine actions, for driving it on a phone against a dev server. 404 in production.
- No new server actions, no migration. `updateScheduleBlock` also accepts `block_type`.
- Guards: `lib/schedule-rail.test.ts` (the wall-clock round trip and the rail arithmetic),
  `schedule/the-day-is-a-rail.test.ts` (renders the rail: position, eye, roles, ghosts, Announce's
  channel, honesty and who may press it, one PickMenu per choice, the guest scene's read, the lab);
  the `a-birthday-has-no-pre-ceremony` guard also covers the rail's phase labels.
- Brief for every later slice: `build-sessions/SCHEDULE-REBUILD-BUILD-BRIEF-2026-09-27.md`.

SPEC IMPACT: None to the decisions — this implements DECISION_LOG "SCHEDULE REDESIGN PROTOTYPE
APPROVED", "WHO SETS UP THE SCHEDULE, AND HOW SUPPLIERS REQUEST CHANGES", "WHO CAN ANNOUNCE" and
"WHERE ANNOUNCEMENTS ARE TYPED". Flagged, not changed: a pre-day announcement reaches guests only
inside the day-of window (guest reader in `app/[slug]/**`, pinned by `day-of-announcement.test.ts`
and owned by the stage builds).
