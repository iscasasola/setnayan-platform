## 2026-10-19 · feat(dress-code): the Guests row gets a call time — the Schedule's "Guests arrive" moment, one field

Owner, on Studio › Mood Board & Dress Code's Guests row (no call time; the code said "Guests have none: they come at the
start"): *"guest call time"* (DECISION_LOG 2026-10-19 "GUESTS GET A CALL TIME IN THE DRESS CODE — THE SAME FIELD AS
'GUESTS ARRIVE'").

- `lib/guests-arrive.ts` — THE guests' arrival moment, in one place: the invitation's first moment (public, for Everyone,
  not a coordinator's prep; the programme's own order) when it is an arrival of its own (not the Ceremony/Reception).
  `guestsArriveWrite` plans the write through the Schedule's OWN writers (`updateScheduleBlock` retimes it,
  `createScheduleBlock` adds a public "Guests arrive" `pre_ceremony` moment), and refuses in plain words a time at or
  after the next moment.
- Studio › Attire › Guests: the shipped `CallTimeRow`, bound to that moment — "Arrives 2:30 PM" in the header, the time
  field, "Set when guests arrive" when there is none; no Clear (it is a Schedule moment). Never a dress-code time.
- Event Details' "Guests arrive" row reads the same resolver (it also stops counting an "Only for · Entourage" moment).
- A guest's Me › Arrive by: the role's own call time still wins; anyone else is told when guests arrive.
- The invitation card is unchanged (`scheduleBlocks[0]`).
- Guard `lib/guests-have-one-arrival-time.test.ts` (one fixture, four readers equal; edits move each other; sabotaged).

SPEC IMPACT: None — implements the 2026-10-19 DECISION_LOG row as written.
