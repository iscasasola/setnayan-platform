## 2026-10-04 · fix(maker): guided steps round 2 — the owner's live walk on maria-and-jose

Measured against real data (read-only SQL on maria-and-jose, prod 6c7c658) where the dev lab's stand-ins hid it.

- **Theme step on Save the Date.** The real cause: the Save the Date page opens with the **film**, and the film wears its own background (`std_background`; on maria-and-jose a plain `#e8d9bd`). It never wears the Event Hub theme. Invitation and The Day have no film, which is why they showed Cyber Neon. The Theme step now opens the page past the film (`#std-after-film`, a new anchor on the canvas slide), on the part the theme dresses. ⚠ Owner call: should the film's default background follow the theme?
- **One count.** The Maker now wears the step states that Home and Event Details count from (`readGuidedPlan`, read by the launch page), so the picker, the Ready screen and Event Details give the same numbers.
- **Parents & hosts.** The step counts as set when a parent or a host is in place, so it now opens on what is in place: a host before "Add a parent". The host's caption is gone.
- **Opening is never dirty.** Only a field the couple touched on this step (a trusted `input`/`change`) can raise "You changed something…". Your colours and What everyone wears now show the Mood Board behind the sheet, and the board's note and downloads hide in the step.
- **Reply by.**
  - One date line: the field's own. The duplicate "Set your event date first." is gone, because the default now reaches Details' settings.
  - The field shows the date in force.
  - One date format, "December 12, 2026".
- **Smaller fixes.**
  - The March caption hides in the step.
  - The cover's "Made once, shown everywhere" line is gone, and its dropdown says the step's word ("Cover photo").
  - How guests get in sits on one row.
  - The Schedule's Journey · Preparation · Event Day is `ISegmented`.
  - The Day shows one "Happening now" (no masthead pill when the live card shows) and "Watch the event live".
  - The Seat plan step drops the tool's title, count, status and room line, and the room overview keeps a margin (`ROOM_OVERVIEW_ZOOM` 0.9), so labels at the walls are no longer cut.
- **Skip goes to the very next screen.** A link step (Your guests' names) is now a screen of the walk (`kind: 'link'`) with Back · Skip · Next and its one way in.
- Guard `lib/the-guided-steps-share-one-layout.test.ts` gains tests (9)–(19), each sabotaged red → green.

**Not changed (owner decisions):**
- Reply by and the Wedding March still write **live** ("Saves immediately"). The reply-by date closes the guest list and times the reminders; the march order is guest rows the Guest list also edits. Neither has a place in the Event Hub draft.
- The RSVP preview is the guest's real reply page. It wears the draft theme (`wearTheHub`), inside the reply door's own frame (the SETNAYAN bar) that guests also see.

SPEC IMPACT: None. This applies standing owner rules (INTERACTION_RULES §8; no captions; one segmented control; "event", never "celebration").
