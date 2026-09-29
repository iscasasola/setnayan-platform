## 2026-09-29 · feat(maker-details): Details part 5 — the guided "What's left", three rounds, any step any time

Implements DECISION_LOG 2026-09-29 "IT NEEDS TO BE VERY EASY — DETAILS OPENS AS A
GUIDED WHAT'S LEFT", "THE EVENT HUB SEQUENCE, STEP 1 TO FINISH — THREE ROUNDS…",
"THE GUIDED FLOW IS APPROVED — AND ANY STEP CAN BE PICKED ANY TIME" and "THE PLAN
ADAPTS TO EVERY EVENT TYPE" (prototypes `event_hub_sequence_2026-09-29.html`,
`details_themes_page_2026-09-28.html?view=easy`).

- **Each step IS a Details item** — the same picture and the same editor, one at
  a time; no new data, no new column, +0 server actions. The sequence is data
  (`lib/details-guided-flow.ts` `GUIDED_STEPS`): Round 1 · Save the Date (names ·
  date & time · venues · theme · colours = Mood Board · logo · first screen =
  hero) → Ready; Round 2 · Invitations (parents & hosts · the march · schedule ·
  RSVP · your words · Love Story, optional · check your prints) → Ready; Round 3 ·
  The day (seat plan — hidden until its Details item exists · day-of prints) →
  Ready.
- **Done = the items' own done** (the navigator's rows). A step is ✓ done, ○ left,
  or a look-over (RSVP, the whole set, the day-of prints — nothing to fill).
  **Next** goes to the next step not done (never over a look-over), then the
  round's Ready; **Skip for now** goes to the very next and marks nothing;
  **Back**. A step with unsaved typing asks first ("Keep editing" / "Go on without
  saving") — never a silent loss.
- **Any step any time**: the progress label ("Round 1 · 3 of 7 ▾") is ONE
  dropdown (the shared `PickMenu`, now with a ✓ / ○ mark per row) listing every
  step of all three rounds; **All items** returns to the grouped navigator, whose
  first chip "What's left" goes back in. A door elsewhere in the Maker that opens
  an item no step shows lands in All items.
- **Ready screens**: the round's steps ✓ set / ○ not yet (each tappable), "Almost
  ready" while something is left, and the round's real action beside **Apply**:
  Round 1 Preview (the Save the Date with the draft) · Share your Save the Date;
  Round 2 Send invitations (the Guest list's own invite flow, `?gview=share`).
  Apply is the draft bar's ONE Apply, pressed by a window event
  (`maker-press-apply.ts`) — same Pro sheet, "nothing to apply" said in words,
  and the first of the two mounted bars claims the press so one tap is one Apply.
- **Opens by itself** for an unfinished event: the Maker with no place named (no
  tool, scene, stage or pin) opens Details on What's left; the tab's own last
  place still wins (a stage included), so stages are never blocked. `?guide=1` /
  `?guide=ready-N` address it; the step rides in the address on reload.
- **Home** shows "Your Event Hub · Round N · x of y · Continue" (couple only,
  streamed in its own Suspense), read through the SAME derivation: the launch
  page's `guidedFactsFrom` now feeds Details' theme / Mood Board / logo / hero ✓
  AND the decision to open; `wordsAndPlansInputFrom` is the one builder of the
  Words · Story & plans input; `readYourEventFacts` is split out of
  `loadYourEvent` (no date-finder work) for Home.
- **Every event type**: steps whose items a type lacks are not in the plan (a
  birthday: no names, no march, no Love Story); the march's step is named by its
  item ("<Event> March"); a solemn event is never promised a countdown; no
  "stage" / "scene" or wedding word on this path.
- First-visit tour `customer_details_guided_v1` (not on the Maker's first visit).
- Lab: `/dev/details-lab?guide=1&fresh=1` (and `?guide=ready-N`).

Tests: `lib/details-guided-flow.test.ts` (order, done, Next/Skip/Back, Home,
address, one derivation, the workspace render with editors kept mounted on
Ready, the one Apply, plain words, and a tripwire for the Seat plan item's key).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — new row "AS BUILT — DETAILS PART 5: THE
GUIDED WHAT'S LEFT" (implements the four rows above; flags for owner sign-off:
the look-over state for items with no "done", the unsaved-typing prompt, and the
Seat plan step's item key `seating`).
