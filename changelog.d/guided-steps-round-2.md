## 2026-10-04 · fix(maker): guided steps round 2 — the owner's live walk on maria-and-jose

Measured against real data (read-only SQL on maria-and-jose, prod 6c7c658) where the dev lab's stand-ins hid it.

- **Theme step on Save the Date.** The real cause: the Save the Date page opens with the **film**, and the film wore its own background (`std_background`; on maria-and-jose a plain `#e8d9bd`), never the Event Hub theme. Owner decision (2026-10-05): **the film's default background follows the theme** unless the couple picked one (`stdFilmBackground`, lib/std-backgrounds.ts — an unset `std_background` paints the theme's canvas). The Theme step shows the page from the top again, film included. ⚠ maria-and-jose has a STORED film background (the Save the Date studio wrote it), so by the rule it counts as picked and stays beige.
- **One count.** The Maker walks the plan Home and Event Details count from (`readGuidedPlan`) — its steps, links and states (`oneCountPlan`), so totals agree too, not only ticks. ⚡ The read starts right after the page's own reads and is handed them (`pre`: the event row, hosts, parents, draft, schedule), so it repeats none of them; it is awaited only where the guide is drawn.
- **Parents & hosts.** The step counts as set when a parent or a host is in place, so it now opens on what is in place: a host before "Add a parent". The host's caption is gone.
- **Opening is never dirty; a real change is never missed** (`lib/guided-step-touch.ts`). A change is the couple's own act on the step: a trusted keystroke/pick in a field (remembered by NAME, so a remounted field still counts), a trusted press on a control that is a choice (switch, radio, option, pressed segment), a pick in the one dropdown (its list is portalled to `<body>`; `touchOrigin` hands it to the button that opened it), or a picker's own `announceMakerTouch`. A field still unsaved asks on any way out; **Skip** from a step the couple changed asks "You changed something on this step. · Keep editing · Skip anyway". A tool filling a field on its own is not a change. Your colours and What everyone wears show the Mood Board behind the sheet; the board's note and downloads hide in the step.
- **Reply by.**
  - One date line: the field's own. The duplicate "Set your event date first." is gone, because the default now reaches Details' settings.
  - The field shows the date in force.
  - One date format, "December 12, 2026".
- **Smaller fixes.**
  - The March caption hides in the step.
  - The cover's "Made once, shown everywhere" line is gone, and its dropdown says the step's word ("Cover photo").
  - How guests get in sits on one row.
  - The Schedule's Journey · Preparation · Event Day wears the one segmented control (`I_SEGMENTED_CLASS` + `iSegClass`, exported from the inspector kit) and each view stays a **link** (`aria-current="page"`, new tab, deep link), as #6352 did for the guest list.
  - The Day shows one "Happening now" (no masthead pill when the live card shows). Every watch-live line says "event" (`watchLiveOccasion`): the live card, the camera picker, the embed and the Facebook card.
  - The Seat plan step drops the tool's title, count, status and room line. The room overview is **measured** (`roomOverviewZoom`, lib/seat-plan-overview.ts): zoomed out by exactly what the labels past a wall need, on every view — measured on maria-and-jose's own room on the NORMAL page too (10 of 14 wall labels cut by 28px at zoom 1; a fixed 0.9 still left 8px cut). It also runs when the plan comes into view from the List.
- **Skip goes to the very next screen.** A link step (Your guests' names) is now a screen of the walk (`kind: 'link'`) with Back · Skip · Next and its one way in.
- Guard `lib/the-guided-steps-share-one-layout.test.ts` gains tests (9)–(22), each sabotaged red → green.

- **Live controls say so plainly** (owner decision 2026-10-05): Reply by and the Wedding March order stay instant; the mark beside every live writer now reads **"Guests see this right away"** (`HUB_LIVE_WORDS`), not "Saves immediately".
- **The guests' reply pages wear the event's theme; Setnayan signs at the foot** (owner decision 2026-10-05). DoorShell gains `brand="foot"`: no wordmark above the couple's card, one small "Made with Setnayan" link under it. Every door under `app/[slug]/` passes it (RSVP, the landing / thank-you, the plus-one page, the request page, and the invite door through the join flow). The plus-one page and the request page (non-Pro themes) now wear the RSVP's skin, so the layout's theme ground is no longer painted over with the bare door's cream. Guard: `app/[slug]/the-guest-doors-wear-the-event.test.ts`.

SPEC IMPACT: None beyond the 2026-10-05 DECISION_LOG row already in the corpus ("consistency-first owner calls": film follows the theme; live controls say "Guests see this right away"; reply pages wear the theme with "Made with Setnayan" at the foot). Otherwise this applies standing owner rules (INTERACTION_RULES §8; no captions; one segmented control; "event", never "celebration").
