## 2026-11-01 · feat(home): frames only where you act — the Schedule widget, the glance row, To do

Builds the owner-approved prototype `prototypes/home_frames_where_you_act_2026-11-01/` (DECISION_LOG 1 Nov "EVENT HOME:
FRAMES ONLY WHERE YOU ACT" · "HOME PROTOTYPE APPROVED" · "SCHEDULE AND BUDGET GO TO HOME") on the shipped Home:

- **Frames.** Cards only where you act — the Schedule, the Budget and Papic (`HOME_FRAMED_WIDGETS`). Countdown sits on the
  page; Guests · Event Hub · Suppliers · To do are an unframed glance row closed by a divider; Who's here, Prints and Your
  services lose their frames (`hc-plain`, plain rows with dividers).
- **The Schedule widget** — full width after the Countdown, read through the chapters (`readHomeSchedule` →
  `homeScheduleFrom` over `chaptersFromBlocks`): Happening now (every running chapter, its running moment as the exact
  line), What's next (all starting together), Then; under the faces the doors the owner kept — N to approve · Release
  (the last week; ◆ PRO on Free) · N need you (`findTaskClashes`) · N owe times (booked suppliers named on nothing).
  ONE round of four reads, started with Home's other reads; a refusal says "Schedule couldn't load", never empty.
- **To do** — the Checklist widget is named To do and reads the one merged list (#7149, Planning Stage's To do filter).
- "N to approve" opens the Schedule's supplier requests sheet (`?sheet=requests`, #7150's Approve all). Not built: the card's share/PDF icon (#7150 shipped
  the export route; its paper picker does not fit a round icon); a Time TBA chapter (#7151) is never "happening now" and shows "Time TBA" in What's next.

Guards: `only-the-acting-widgets-are-framed.test.ts`, `the-schedule-widget-reads-chapters.test.ts`, and the failed-read
case in `home-control-reads-honestly.test.ts`.

SPEC IMPACT: None — builds an approved prototype; its labelled assumptions (order, the "To do" word) stand.
