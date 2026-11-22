## 2026-11-22 · feat(chat): Unichat part F parity — the time card, the risen day and the hosts' whole day, to the drawing

Follow-up to #8080 (Unichat F, the schedule from the chat), built item by item from the ship controller's parity list
against `prototypes/unichat_live_v3_2026-11-20.html`. No migration. No new server action (1251 of 1251).

- **The time-change card** — the title is the moment's name, the icon is the stopwatch (`KindCard mark="time"`), the
  second line is "~~from~~ → to · 18 Dec · 30 min". "Asked by", "Waiting for", the note, a No's reason and "The hosts
  and their coordinator own the event Schedule" moved into the card's ⓘ. **Take back** keeps working and moved into the
  ⓘ sheet too.
- **Decline asks for a reason** (required, 500 characters) on both sides. The reason is kept on the request and said
  back in the chat as a quiet line — "Ingress & setup stays 1:00 PM · <reason>", "Haze test isn't added · <reason>" —
  from the supplier's door (`answerScheduleAsk`) and the hosts' door (`resolveScheduleSuggestion`). Best-effort, after
  the answer is written; a Time-TBA moment says "stays as it is", never 12:00 AM.
- **The risen list** (`agenda-rise.tsx`) — "Your part of the day" is the drawing's timeline (a dot per moment, a line
  between, ⏱ on the ones you may ask to move); the Done fold has no caret and full ink; the date tile is 36 px and the
  pill 11 px; the list keeps phone width on a computer. Its parts live once, in `app/_components/day-rise-parts.tsx`.
- **The rise screen** — a screen risen from a chat (`RiseScreen back="Back to chat"`) has the drawing's ‹ and white
  head with a soft shadow over the page's grey. Every other full screen keeps ✕ (opt-in prop).
- **Hours copy** — "Event 4:00–9:30 PM" (one AM/PM when both share it; "11:00 AM – 2:00 PM" across noon).
- **The hosts' whole day (new)** — the hosts' chat ⋯ › Schedule raises "The whole day" over the chat (`?day=1`,
  read only then): what is dated with that shop, the event day's hours ("… sets these on its card; you confirm on the
  event Schedule"), "Edit on the event Schedule", and every moment; the shop's moments open the shipped ask
  (`AskSupplierSection`) with the shop picked.
- **"New moment" card kept** — DECISION_LOG 2026-10-03 "SUPPLIERS WRITE THEIR OWN PART OF THE SCHEDULE" (*"yes
  correct. they still approve or decline"*) and 2026-11-02 "+ My moment" rule a supplier may ask to add a moment.
- **Lab** `/dev/unichat-f-lab`: `?m=whole` (the hosts' whole day), Liza the coordinator answering in the hosts' chat,
  the drawing's facts on every card.
- Guards: new `app/_components/the-risen-day-is-the-drawing.test.ts`; `the-card-kinds-are-readable` holds the ⏱;
  `the-rise-screen-is-one-full-screen` reads the one head row both heads wear; `schedule-time-ask.test.ts` test 5;
  `venue-window.test.ts` tests 1 and 6; the new host reader is classed in the guests' schedule fence.

SPEC IMPACT: None — builds the approved drawing; no ruling changed.
